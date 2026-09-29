if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as unknown as Record<string, unknown>).DOMMatrix = class DOMMatrix {};
}

import { GoogleGenAI, Type } from '@google/genai';
import { extractZipCode } from '@/lib/geo/commute';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface JobContext {
  title: string;
  description: string;
  requirements: string;
}

export interface SubScores {
  functionalExperience: number;
  requiredCredentials: number;
  roleSpecificSkills: number;
}

export interface DynamicRequirementCheck {
  requirement_extracted_from_jd: string;
  match_level: 'Full Match' | 'Semantic Match' | 'Missing';
  reasoning: string;
  evidence_quote: string | null;
}

export interface ParsedCandidate {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  zip_code?: string | null;
  primarySkills: string[];
  yearsOfExperience: number;
  fitSummary: string;
  fitRating: number;
  subScores?: SubScores;
  rawResumeText?: string;
  work_experience?: Array<{ jobTitle: string; company: string; location?: string; dates: string; isCurrent?: boolean; summary: string }>;
  education?: Array<{ degree: string; fieldOfStudy: string; institution: string; year: string }>;
  certifications?: Array<{ name: string; issuingOrganization?: string; issueDate?: string; expirationDate?: string }>;
  jdMinimumExperienceMet?: boolean;
  dynamicRequirementsCheck?: DynamicRequirementCheck[];
  criticalGaps?: string[];
  modelUsed?: string;
}

interface RawIntakeOutput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  zip_code?: string | null;
  primarySkills?: string[];
  years_of_experience?: number;
  jd_minimum_experience_met?: boolean;
  jd_minimum_experience_years?: number;
  dynamic_requirements_check?: DynamicRequirementCheck[];
  critical_gaps?: string[];
  summary?: string;
  fit_rating_1_to_5?: number;
  rawResumeText?: string;
  work_experience?: Array<{ jobTitle: string; company: string; location?: string; dates: string; isCurrent?: boolean; summary: string }>;
  education?: Array<{ degree: string; fieldOfStudy: string; institution: string; year: string }>;
  certifications?: Array<{ name: string; issuingOrganization?: string; issueDate?: string; expirationDate?: string }>;
}

const INTAKE_INSTRUCTIONS =
  "You are an elite Enterprise ATS Intake Parser. Your task is to extract factual data from the candidate's resume with extreme precision.\n" +
  "1. Extract ALL explicitly stated mandatory requirements from the Job Description and evaluate if they are explicitly met in the resume.\n" +
  "2. Full Chronological Work History: Extract up to 8 of the most relevant employment records. Include jobTitle, company, location, dates, isCurrent, and summarize their quantifiable impact.\n" +
  "3. Structured Education & Certifications: Explicitly extract degrees (institution, degree, field, year) and certifications/licenses (Driver's License, CPR, Notary, PMP, RN) as dedicated fields.\n" +
  "4. Accurate Tenure Math: Calculate the true 'years_of_experience' by performing date math across non-overlapping tenures. Do not just trust the candidate's summary claim.\n" +
  "5. Skills Taxonomy: Distinguish between Core Domain, Technical/Software, and Soft Skills, and aggregate them into 'primarySkills'.\n" +
  "6. Full-Fidelity Transcription: Guarantee that 100% of the resume's text is faithfully transcribed into 'rawResumeText' without any truncation or summarization.\n" +
  "Do not assume or infer qualifications. Provide exact quotes for verified items.";

const CREDENTIAL_PATTERN = /certif|licen|degree|education|credential|clearance|diploma|registration|\bboard\b|\bcpr\b|\bfirst aid\b|\bcna\b|\blpn\b|\brn\b|\blvn\b/i;

export function computeExperienceScore(
  yearsOfExperience: number,
  metMinimum: boolean | undefined,
  requiredYears: number | undefined
): number {
  if (metMinimum) return 5;
  const required = requiredYears && requiredYears > 0 ? requiredYears : 5;
  const ratio = yearsOfExperience / required;
  return Math.max(1, Math.min(4, Math.round(5 * ratio)));
}

export function computeCredentialSkillsScores(
  checks: DynamicRequirementCheck[]
): { requiredCredentials: number; roleSpecificSkills: number } {
  const creds = checks.filter((c) => CREDENTIAL_PATTERN.test(c.requirement_extracted_from_jd));
  const skills = checks.filter((c) => !CREDENTIAL_PATTERN.test(c.requirement_extracted_from_jd));

  const scoreOf = (list: DynamicRequirementCheck[]): number | null => {
    if (list.length === 0) return null;
    let score = 0;
    list.forEach(c => {
      if (c.match_level === 'Full Match') score += 1;
      else if (c.match_level === 'Semantic Match') score += 0.8;
    });
    return Math.max(1, Math.min(5, Math.round((score / list.length) * 5)));
  };

  const combined = scoreOf(checks) ?? 3;
  return {
    requiredCredentials: scoreOf(creds) ?? combined,
    roleSpecificSkills: scoreOf(skills) ?? combined,
  };
}

export function computeSubScores(raw: RawIntakeOutput): SubScores {
  const checks = raw.dynamic_requirements_check ?? [];
  const { requiredCredentials, roleSpecificSkills } = computeCredentialSkillsScores(checks);
  const functionalExperience = computeExperienceScore(
    raw.years_of_experience ?? 0,
    raw.jd_minimum_experience_met,
    raw.jd_minimum_experience_years
  );
  return { functionalExperience, requiredCredentials, roleSpecificSkills };
}

export function computeFitRating(subScores: SubScores): number {
  const avg = (subScores.functionalExperience + subScores.requiredCredentials + subScores.roleSpecificSkills) / 3;
  return Math.max(1, Math.min(5, Math.round(avg)));
}

const STRICT_JSON_MANDATE =
  'Respond with raw JSON only matching the schema. Do not include markdown code fences, backticks, or any conversational text.';

const PARSER_JSON_INSTRUCTION = `Return ONLY valid JSON (no markdown fences, no explanatory text) matching exactly this schema:
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "address": "string",
  "zip_code": "string",
  "primarySkills": ["string"],
  "years_of_experience": 0,
  "jd_minimum_experience_met": true,
  "jd_minimum_experience_years": 0,
  "dynamic_requirements_check": [
    {
      "requirement_extracted_from_jd": "string",
      "match_level": "Full Match | Semantic Match | Missing",
      "reasoning": "string",
      "evidence_quote": "string or null"
    }
  ],
  "fit_rating_1_to_5": 0,
  "critical_gaps": ["string"],
  "summary": "string",
  "rawResumeText": "string",
  "work_experience": [
    {
      "jobTitle": "string",
      "company": "string",
      "location": "string",
      "dates": "string",
      "isCurrent": false,
      "summary": "string"
    }
  ],
  "education": [
    {
      "degree": "string",
      "fieldOfStudy": "string",
      "institution": "string",
      "year": "string"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuingOrganization": "string",
      "issueDate": "string",
      "expirationDate": "string"
    }
  ]
}`;

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();
    return data.text?.trim() ?? '';
  } catch (error) {
    console.error('[Parser] pdf-parse error:', error);
    return '';
  }
}

function parseModelJson(rawContent: string): RawIntakeOutput {
  const text = rawContent.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end <= start) {
    console.error('[Parser] AI Raw Output Failed to Parse (no braces):', rawContent);
    throw new Error('Failed to parse resume: No JSON object found in AI response');
  }

  let jsonCandidate = text.slice(start, end + 1);
  jsonCandidate = jsonCandidate.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(jsonCandidate) as RawIntakeOutput;
  } catch {
    console.error('[Parser] AI Raw Output Failed to Parse (JSON syntax error):', rawContent);
    throw new Error('Failed to parse resume: Invalid JSON response from AI');
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

async function buildResumeMessages(
  payload: File | string,
  jobDescriptionText: string
): Promise<ChatMessage[]> {
  const systemContent = `${INTAKE_INSTRUCTIONS}\n\n${STRICT_JSON_MANDATE}`;
  const zipRule =
    'ZIP CODE EXTRACTION RULE: Always extract the candidate\'s 5-digit U.S. postal ZIP code into the separate `zip_code` field, even if it is also present inside the main address string (e.g., "Philadelphia, PA 19124" or a dedicated ZIP/Postal Code line). If no ZIP code can be found anywhere, return an empty string.';

  let resumeText = '';
  let fileBase64 = '';
  let mimeType = 'application/pdf';

  if (typeof payload === 'string') {
    resumeText = payload;
  } else {
    mimeType = payload.type || 'application/pdf';
    const isText = mimeType.startsWith('text/') || /\.(txt|md|csv)$/i.test(payload.name);
    if (isText) {
      resumeText = await payload.text();
    } else {
      const buffer = Buffer.from(await payload.arrayBuffer());
      fileBase64 = buffer.toString('base64');
      const extracted = await extractTextFromPdfBuffer(buffer);
      if (extracted && extracted.length > 50) {
        resumeText = extracted;
      }
    }
  }

  if (resumeText) {
    return [
      { role: 'system', content: systemContent },
      {
        role: 'user',
        content: `${PARSER_JSON_INSTRUCTION}\n\n${jobDescriptionText}\n\n${zipRule}\n\nCandidate Resume:\n${resumeText}`,
      },
    ];
  }

  if (fileBase64) {
    return [
      { role: 'system', content: systemContent },
      {
        role: 'user',
        content: [
          { type: 'text', text: `${PARSER_JSON_INSTRUCTION}\n\n${jobDescriptionText}\n\n${zipRule}\n\nCandidate Resume (Attached): Please parse the details from this document.` },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } }
        ]
      }
    ];
  }

  // If we couldn't extract text and have to rely on binary, the DeepSeek
  // text fallback cannot process multimodal (PDF) inputs.
  throw new Error(
    'PDF text extraction failed and the DeepSeek fallback cannot process binary files. ' +
    'Please upload a .docx or plain-text resume, or try again when Gemini is available.'
  );
}

export async function parseResumeData(payload: File | string, jobContext?: JobContext): Promise<ParsedCandidate> {
  if (!jobContext?.title || !jobContext?.description || jobContext.description.trim().length === 0) {
    throw new Error("Job context missing. Cannot parse resume without a valid job description.");
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      firstName: { type: Type.STRING },
      lastName: { type: Type.STRING },
      email: { type: Type.STRING },
      phone: { type: Type.STRING },
      address: { type: Type.STRING },
      zip_code: {
        type: Type.STRING,
        description: "The candidate's 5-digit US postal code, extracted as a separate string even when it also appears inside the address. Return an empty string if no ZIP code is present.",
      },
      primarySkills: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Categorize skills into Core Domain Competencies, Technical/Software Tools, and Soft/Leadership capabilities, then return as a single aggregated array of strings."
      },
      years_of_experience: {
        type: Type.NUMBER,
        description: "Calculate continuous professional experience by performing precise date math across non-overlapping employment tenures."
      },
      jd_minimum_experience_met: {
        type: Type.BOOLEAN,
        description: "True if the resume work history meets or exceeds the minimum years of experience explicitly required by the Job Description; otherwise false."
      },
      jd_minimum_experience_years: {
        type: Type.NUMBER,
        description: "The minimum years of experience explicitly required by the Job Description. Return 0 if the JD does not state a numeric minimum."
      },
      dynamic_requirements_check: {
        type: Type.ARRAY,
        description: "All explicitly stated mandatory requirements from the Job Description, each evaluated semantically against the resume.",
        items: {
          type: Type.OBJECT,
          properties: {
            requirement_extracted_from_jd: { type: Type.STRING, description: "A specific mandatory requirement stated in the Job Description." },
            match_level: { type: Type.STRING, description: "'Full Match', 'Semantic Match', or 'Missing'" },
            reasoning: { type: Type.STRING, description: "One sentence reasoning justifying the match level choice based on resume content." },
            evidence_quote: {
              type: Type.STRING,
              nullable: true,
              description: "Exact string excerpt from the resume that proves the requirement, or null when Missing."
            }
          },
          required: ["requirement_extracted_from_jd", "match_level", "reasoning", "evidence_quote"]
        }
      },
      fit_rating_1_to_5: {
        type: Type.NUMBER,
        description: "Holistic 1-5 star rating based on how well the candidate fits the role. (1 = Poor, 5 = Excellent)"
      },
      critical_gaps: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of Job Description requirements whose met_in_resume evaluated to false."
      },
      summary: {
        type: Type.STRING,
        description: "Concise 2-sentence synopsis stating total experience, alignment with the specific Job Description, and noting any critical gaps."
      },
      rawResumeText: {
        type: Type.STRING,
        description: "Comprehensive extraction and transcription of the candidate's complete resume text content including career history, education, and credentials."
      },
      work_experience: {
        type: Type.ARRAY,
        description: "Extract the full chronological employment history (up to 8 roles) with standardized jobTitle, company, dates, location, isCurrent, and metric-backed impact bullet points.",
        items: {
          type: Type.OBJECT,
          properties: {
            jobTitle: { type: Type.STRING },
            company: { type: Type.STRING },
            location: { type: Type.STRING },
            dates: { type: Type.STRING },
            isCurrent: { type: Type.BOOLEAN },
            summary: { type: Type.STRING, description: "Metric-backed impact summary" }
          },
          required: ["jobTitle", "company", "dates", "summary"]
        }
      },
      education: {
        type: Type.ARRAY,
        description: "Explicitly extract structured education.",
        items: {
          type: Type.OBJECT,
          properties: {
            degree: { type: Type.STRING },
            fieldOfStudy: { type: Type.STRING },
            institution: { type: Type.STRING },
            year: { type: Type.STRING }
          },
          required: ["degree", "institution"]
        }
      },
      certifications: {
        type: Type.ARRAY,
        description: "Explicitly extract certifications and licensures (e.g., Driver's License, CPR, Notary, RN, PMP).",
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            issuingOrganization: { type: Type.STRING },
            issueDate: { type: Type.STRING },
            expirationDate: { type: Type.STRING }
          },
          required: ["name"]
        }
      }
    },
    required: [
      "firstName",
      "lastName",
      "email",
      "phone",
      "address",
      "zip_code",
      "primarySkills",
      "years_of_experience",
      "jd_minimum_experience_met",
      "dynamic_requirements_check",
      "critical_gaps",
      "summary",
      "fit_rating_1_to_5"
    ]
  };

  const jobDescriptionText =
    `Target Job Title: ${jobContext.title}\n` +
    `Target Job Description: ${jobContext.description}\n` +
    `Target Job Requirements: ${jobContext.requirements || ''}`;

  let contents: Array<string | { inlineData: { data: string; mimeType: string } }>;

  if (typeof payload === 'string') {
    contents = [
      `${INTAKE_INSTRUCTIONS}\n\n${jobDescriptionText}\n\nCandidate Resume:\n${payload}\n\nZIP CODE EXTRACTION RULE: Always extract the candidate's 5-digit U.S. postal ZIP code into the separate \`zip_code\` field, even if it is also present inside the main address string (e.g., "Philadelphia, PA 19124" or a dedicated ZIP/Postal Code line). If no ZIP code can be found anywhere, return an empty string.`
    ];
  } else {
    // It's a File object
    const fileBase64 = Buffer.from(await payload.arrayBuffer()).toString('base64');
    const mimeType = payload.type || 'application/pdf'; // fallback to pdf

    contents = [
      `${INTAKE_INSTRUCTIONS}\n\n${jobDescriptionText}\n\nZIP CODE EXTRACTION RULE: Always extract the candidate's 5-digit U.S. postal ZIP code into the separate \`zip_code\` field, even if it is also present inside the main address string (e.g., "Philadelphia, PA 19124" or a dedicated ZIP/Postal Code line). If no ZIP code can be found anywhere, return an empty string.`,
      {
        inlineData: {
          data: fileBase64,
          mimeType: mimeType
        }
      }
    ];
  }

  const generateWithModel = (model: string) => ai.models.generateContent({
    model: model,
    contents: contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.1, // Low temperature for more deterministic extraction
    }
  });

  const GEMINI_MODELS = [
    'gemini-3.0-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
  ];

  const extractHttpStatus = (error: unknown): number | undefined => {
    if (!error) return undefined;
    const errObj = typeof error === 'object' ? (error as Record<string, unknown>) : null;
    for (const key of ['status', 'statusCode', 'code']) {
      const value = errObj?.[key];
      if (typeof value === 'number') return value;
    }
    const msg = error instanceof Error ? error.message : String(error);
    const match = msg.match(/\b(400|404|429|503)\b/);
    return match ? Number(match[1]) : undefined;
  };

  const isRateLimitError = (error: unknown): boolean => {
    if (!error) return false;
    const errObj = typeof error === 'object' ? (error as Record<string, unknown>) : null;
    const nested = errObj?.error as { code?: unknown } | undefined;
    const message = error instanceof Error ? error.message : String(error);
    return (
      errObj?.status === 429 ||
      errObj?.code === 429 ||
      nested?.code === 429 ||
      errObj?.status === 503 ||
      message.includes('429') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('quota') ||
      message.includes('503')
    );
  };

  // Dynamically resolve any valid Flash model in case every hardcoded alias is deprecated.
  const fetchDynamicFlashModel = async (): Promise<string | null> => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      if (!res.ok) {
        console.warn(`[Parser] Dynamic Gemini model list failed (${res.status})`);
        return null;
      }
      const data = await res.json();
      const models: Array<{ name?: string }> = data?.models ?? [];
      const selectedModelName = models
        .map((m) => m.name)
        .filter((name): name is string => typeof name === 'string' && name.includes('flash'))
        .sort((a, b) => a.length - b.length)[0];
      if (selectedModelName) {
        console.log('[Parser] Hardcoded models failed. Self-healing selected dynamic model:', selectedModelName);
        return selectedModelName;
      }
    } catch (err) {
      console.warn('[Parser] Error resolving dynamic Gemini Flash model:', err instanceof Error ? err.message : String(err));
    }
    return null;
  };

  const generateWithDeepSeek = async (): Promise<RawIntakeOutput> => {
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[Parser Error] DEEPSEEK_API_KEY is undefined in process.env!');
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DeepSeek fallback skipped: DEEPSEEK_API_KEY is not set');
    }

    const jobDescriptionText =
      `Target Job Title: ${jobContext.title}\n` +
      `Target Job Description: ${jobContext.description}\n` +
      `Target Job Requirements: ${jobContext.requirements || ''}`;

    console.log('[Parser] Entering DeepSeek Tier 2. Key exists:', Boolean(process.env.DEEPSEEK_API_KEY));

    try {
      const messages = await buildResumeMessages(payload, jobDescriptionText);

      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 8192,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[DeepSeek API Error] HTTP ${res.status}:`, errorText);
        throw new Error(`DeepSeek API failed (${res.status}): ${errorText.slice(0, 300)}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string' || !content.trim()) {
        throw new Error('DeepSeek returned empty content');
      }

      return parseModelJson(content);
    } catch (deepSeekErr: unknown) {
      console.error('[Parser] DeepSeek request threw an error:', deepSeekErr);
      throw deepSeekErr;
    }
  };

  let raw: RawIntakeOutput | undefined;
  let modelUsed = '';

  const parseGeminiText = (text: string | undefined): RawIntakeOutput => {
    if (!text) throw new Error('Failed to parse resume: No response text from Gemini');
    try {
      return JSON.parse(text) as RawIntakeOutput;
    } catch {
      throw new Error('Failed to parse resume: Invalid JSON response');
    }
  };

  // === Tier 1: Gemini Flash-Lite with Self-Healing ===
  let tier1Error: unknown = null;
  let hitRateLimit = false;

  try {
    const geminiModels = [...GEMINI_MODELS];

    for (const model of geminiModels) {
      console.log('[Parser] Trying Gemini model:', model);
      let response;
      try {
        response = await generateWithModel(model);
        if (response?.text) {
          raw = parseGeminiText(response.text);
          modelUsed = model;
          break;
        }
      } catch (err: unknown) {
        const status = extractHttpStatus(err);
        if (isRateLimitError(err)) {
          console.warn(`[Parser] Quota/rate limit detected on ${model}. Instantly falling back to Tier 2 (DeepSeek)...`);
          tier1Error = err;
          hitRateLimit = true;
          break;
        }
        if (status === 400 || status === 404) {
          console.warn(`[Parser] Gemini model ${model} is unavailable (${status}). Trying next alias...`);
          tier1Error = err;
          continue;
        }
        tier1Error = err;
      }
    }

    // All hardcoded aliases deprecated (400/404) — dynamically resolve a live Flash model.
    if (!raw && !hitRateLimit) {
      const dynamicModel = await fetchDynamicFlashModel();
      if (dynamicModel) {
        try {
          const dynamicResponse = await generateWithModel(dynamicModel);
          if (dynamicResponse?.text) {
            raw = parseGeminiText(dynamicResponse.text);
            modelUsed = dynamicModel;
          }
        } catch (err: unknown) {
          const status = extractHttpStatus(err);
          if (isRateLimitError(err)) {
            console.warn(`[Parser] Dynamic Gemini model quota/rate limited (${status ?? 'unknown'}). Failing over to DeepSeek.`);
            hitRateLimit = true;
          }
          tier1Error = err;
        }
      }
    }
  } catch (err: unknown) {
    tier1Error = err;
  }

  // === Tier 2: Direct DeepSeek fallback ===
  if (!raw) {
    console.warn('[Parser] Gemini Tier 1 failed. Engaging DeepSeek Tier 2 backstop...');
    try {
      raw = await generateWithDeepSeek();
      modelUsed = 'deepseek-chat';
    } catch (deepseekErr: unknown) {
      const deepseekMsg = deepseekErr instanceof Error ? deepseekErr.message : String(deepseekErr);
      console.error('[Parser] DeepSeek Tier 2 failed:', deepseekMsg);
      const originalMsg = tier1Error instanceof Error ? tier1Error.message : String(tier1Error ?? '');
      throw new Error(originalMsg ? `${originalMsg} | DeepSeek Failed: ${deepseekMsg}` : `DeepSeek Failed: ${deepseekMsg}`);
    }
  }

  const subScores = computeSubScores(raw);
  const fitRating = raw.fit_rating_1_to_5 ?? computeFitRating(subScores);

  const parsed: ParsedCandidate = {
    firstName: raw.firstName ?? '',
    lastName: raw.lastName ?? '',
    email: raw.email ?? '',
    phone: raw.phone ?? '',
    address: raw.address ?? '',
    zip_code: raw.zip_code ?? null,
    primarySkills: raw.primarySkills ?? [],
    yearsOfExperience: raw.years_of_experience ?? 0,
    fitSummary: raw.summary ?? '',
    fitRating,
    subScores,
    rawResumeText: raw.rawResumeText,
    work_experience: raw.work_experience,
    education: raw.education,
    certifications: raw.certifications,
    jdMinimumExperienceMet: raw.jd_minimum_experience_met,
    dynamicRequirementsCheck: raw.dynamic_requirements_check,
    criticalGaps: raw.critical_gaps,
    modelUsed,
  };

  if (typeof payload === 'string' && !parsed.rawResumeText) {
    parsed.rawResumeText = payload;
  }
  if (!parsed.zip_code && parsed.address) {
    parsed.zip_code = extractZipCode(parsed.address);
  }

  return parsed;
}