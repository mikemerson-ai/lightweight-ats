import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface JobEvaluationContext {
  title: string;
  description: string;
  requirements?: string;
}

export type ScorecardRecommendation = 'STRONG PURSUE' | 'CONDITIONAL SCREEN' | 'DO NOT ADVANCE' | 'UNKNOWN';

export interface HardGateItem {
  requirement: string;
  status: 'Match' | 'Partial' | 'Missing';
  evidence: string;
}

export interface RecruiterProbe {
  targetGap: string;
  question: string;
}

export interface ScorecardResult {
  candidateName: string;
  targetRole: string;
  recommendation: ScorecardRecommendation;
  fitScore: number;
  hardGates?: HardGateItem[];
  experienceImpact?: {
    quantifiedImpact: string;
    scopeSeniorityAlignment: string;
    careerTrajectory: string;
  };
  redFlags?: string[];
  interviewProbes?: RecruiterProbe[];
  markdown: string;
}

interface RawScorecard {
  candidateName?: string;
  recommendation?: string;
  fitScore?: number;
  hardGates?: HardGateItem[];
  experienceImpact?: {
    quantifiedImpact: string;
    scopeSeniorityAlignment: string;
    careerTrajectory: string;
  };
  redFlags?: string[];
  interviewProbes?: RecruiterProbe[];
}

function buildScorecardMarkdown(structured: RawScorecard, targetRole: string): string {
  let md = `## Candidate Screening Summary\n`;
  md += `- **Candidate Name:** ${structured.candidateName || 'Candidate'}\n`;
  md += `- **Target Role:** ${targetRole}\n`;
  md += `- **Match Recommendation:** ${structured.recommendation}\n`;
  md += `- **Overall Fit Score:** ${structured.fitScore}/100\n\n`;

  md += `### 1. Hard Gate Requirements Check\n`;
  md += `| Non-Negotiable Requirement | Status (Match / Partial / Missing) | Exact Evidence / Resume Snippet |\n`;
  md += `| :--- | :--- | :--- |\n`;
  for (const gate of (structured.hardGates || [])) {
    const statusText = gate.status === 'Match' || gate.status?.toLowerCase().includes('match')
      ? 'Strong Match'
      : gate.status === 'Partial' || gate.status?.toLowerCase().includes('partial')
      ? 'Partial Match'
      : 'Missing / Not Evident';
    const evidenceStr = (gate.evidence || 'Not Evident').replace(/"/g, "'");
    md += `| ${gate.requirement} | ${statusText} | "${evidenceStr}" |\n`;
  }
  md += `\n`;

  md += `### 2. Experience & Impact Analysis\n`;
  md += `- **Quantified Impact (XYZ/STAR):** ${structured.experienceImpact?.quantifiedImpact || 'N/A'}\n`;
  md += `- **Scope & Seniority Alignment:** ${structured.experienceImpact?.scopeSeniorityAlignment || 'N/A'}\n`;
  md += `- **Career Trajectory:** ${structured.experienceImpact?.careerTrajectory || 'N/A'}\n\n`;

  md += `### 3. Red Flags & Knowledge Gaps\n`;
  for (const flag of (structured.redFlags || [])) {
    md += `- ${flag}\n`;
  }
  md += `\n`;

  md += `### 4. Recruiter Interview Probes (If Advancing)\n`;
  md += `Formulate 2-3 behavioral or technical drill-down questions targeting ambiguities or partial matches:\n`;
  (structured.interviewProbes || []).forEach((probe: RecruiterProbe, idx: number) => {
    md += `${idx + 1}. *[${probe.targetGap || 'Probe'}]*: "${(probe.question || '').replace(/"/g, "'")}"\n`;
  });

  return md;
}

function parseGeminiResponse(response: { text?: string } | undefined): RawScorecard {
  const responseText = response?.text || '';
  if (!responseText) {
    throw new Error('Failed to generate scorecard: No response text received from Gemini');
  }
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error('Failed to generate scorecard: Invalid structured response from AI');
  }
}

let cachedOpenRouterModel: string | null = null;
let lastOrFetch = 0;

async function getDynamicOpenRouterFreeModel(): Promise<string> {
  const now = Date.now();
  if (cachedOpenRouterModel && (now - lastOrFetch < 24 * 60 * 60 * 1000)) {
    return cachedOpenRouterModel;
  }
  
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
    const data = await res.json();
    
    // Filter for free models
    const freeModels = data.data.filter((m: any) => m.id.endsWith(':free'));
    
    // Filter out highly specialized models (code, fin, sante, safety, etc.)
    const genericModels = freeModels.filter((m: any) => {
      const id = m.id.toLowerCase();
      return !id.includes('code') && !id.includes('safety') && !id.includes('fin') && !id.includes('sante');
    });

    // Sort by context length descending to get the most powerful/capable model
    genericModels.sort((a: any, b: any) => (b.context_length || 0) - (a.context_length || 0));
    
    if (genericModels.length > 0 && typeof genericModels[0].id === 'string') {
      const selectedModel: string = genericModels[0].id;
      cachedOpenRouterModel = selectedModel;
      lastOrFetch = now;
      console.log(`[Evaluator] Dynamically selected OpenRouter fallback model: ${cachedOpenRouterModel}`);
      return selectedModel;
    }
  } catch (err) {
    console.warn('[Evaluator] Failed to fetch dynamic OR model, falling back to default', err);
  }
  
  return 'google/gemma-3-27b-it:free';
}

const OPENROUTER_STRICT_JSON_MANDATE =
  'Respond with raw JSON only matching the schema. Do not include markdown code fences, backticks, or any conversational text.';

const OPENROUTER_JSON_INSTRUCTION = `Return ONLY valid JSON (no markdown fences, no additional commentary) that exactly matches this shape:
{
  "candidateName": string,
  "hardGates": [ { "requirement": string, "status": "Match" | "Partial" | "Missing", "evidence": string } ],
  "experienceImpact": { "quantifiedImpact": string, "scopeSeniorityAlignment": string, "careerTrajectory": string },
  "redFlags": [ string ],
  "interviewProbes": [ { "targetGap": string, "question": string } ],
  "reasoning_buffer": string (Chain-of-thought paragraph analyzing the gates, impacts, and flags),
  "recommendation": "STRONG PURSUE" | "CONDITIONAL SCREEN" | "DO NOT ADVANCE",
  "fitScore": integer between 0 and 100
}`;

function parseJsonFromModelOutput(rawContent: string): RawScorecard {
  const text = rawContent.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end <= start) {
    console.error("OpenRouter Raw Output Failed to Parse:", rawContent);
    throw new Error('Failed to generate scorecard: No JSON object found in OpenRouter response');
  }

  let jsonCandidate = text.slice(start, end + 1);
  jsonCandidate = jsonCandidate.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(jsonCandidate);
  } catch {
    console.error("OpenRouter Raw Output Failed to Parse:", rawContent);
    throw new Error('Failed to generate scorecard: Invalid structured response from OpenRouter');
  }
}

async function buildOpenRouterUserContent(payload: File | string): Promise<string> {
  if (typeof payload === 'string') {
    return payload;
  }
  const isText = payload.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(payload.name);
  if (isText) {
    return await payload.text();
  }
  throw new Error(
    'PDF text extraction failed and the OpenRouter fallback cannot process binary files. ' +
    'Please upload a .docx or plain-text resume, or try again when Gemini is available.'
  );
}

async function generateViaOpenRouter(
  systemInstructions: string,
  payload: File | string,
  originalError: unknown,
): Promise<RawScorecard> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw originalError;
  }

  const userContent = await buildOpenRouterUserContent(payload);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Lightweight ATS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: await getDynamicOpenRouterFreeModel(),
      messages: [
        { role: 'system', content: `${systemInstructions}\n\n${OPENROUTER_STRICT_JSON_MANDATE}` },
        { role: 'user', content: `${OPENROUTER_JSON_INSTRUCTION}\n\nCandidate Resume:\n${userContent}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter fallback failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenRouter fallback returned no content');
  }

  return parseJsonFromModelOutput(content);
}

export async function evaluateResumeAgainstJD(
  payload: File | string,
  jobContext: JobEvaluationContext
): Promise<ScorecardResult> {
  if (!jobContext.title || !jobContext.description || jobContext.description.trim().length === 0) {
    throw new Error('FATAL: Missing jobTitle or jobDescription for resume evaluation.');
  }

  const systemInstructions = `<Role>
You are an expert Technical Recruiter and Talent Acquisition Lead. Your task is to objectively evaluate candidate resumes against a provided Job Description (JD) and produce an unbiased, evidence-backed evaluation scorecard.
</Role>

<OperationalPrinciples>
1. ZERO HALLUCINATION: Evaluate skills strictly based on the resume text. 
2. SEMANTIC EQUIVALENCY: Apply industry-standard semantic equivalencies (e.g., AWS EC2 = Cloud Computing), but explicitly justify this inference in your evaluation evidence.
3. SKILL DEPTH: Do not merely check if a required skill is mentioned. Evaluate context: was it a core part of a major project delivering impact, or just buried in a list?
4. TENURE STABILITY: Explicitly flag patterns of job-hopping (e.g., multiple stints under 1 year) in the red flags.
5. IMPACT OVER BUZZWORDS: Prioritize candidates whose achievements reflect scope, metric-driven business outcomes, and clear ownership.
</OperationalPrinciples>

<InputContext>
Target Job Title: ${jobContext.title}
Target Job Description: ${jobContext.description}
Target Job Requirements: ${jobContext.requirements || 'Standard requirements as outlined in description'}
</InputContext>

<Task>
Generate a structured evaluation matching the requested JSON schema.
- Evaluate ALL core non-negotiable requirements for the 'hardGates', using direct quotes from the resume as evidence.
- Assess quantified outcomes, seniority alignment, and career trajectory for the 'experienceImpact'.
- Formulate 2-3 targeted recruiter screening drill-down questions ('interviewProbes') to probe ambiguities or partial matches.

SCORING CALIBRATION:
- 90-100: Exceptional match (STRONG PURSUE). Meets all hard gates with high impact.
- 70-89: Solid match with minor gaps (CONDITIONAL SCREEN).
- Below 70: Significant gaps or red flags (DO NOT ADVANCE).
</Task>`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      candidateName: { type: Type.STRING },
      hardGates: {
        type: Type.ARRAY,
        description: "All core non-negotiable requirements.",
        items: {
          type: Type.OBJECT,
          properties: {
            requirement: { type: Type.STRING },
            status: { type: Type.STRING, description: "'Match', 'Partial', or 'Missing'" },
            evidence: { type: Type.STRING, description: "Direct quote or observation from resume." }
          },
          required: ["requirement", "status", "evidence"]
        }
      },
      experienceImpact: {
        type: Type.OBJECT,
        properties: {
          quantifiedImpact: { type: Type.STRING },
          scopeSeniorityAlignment: { type: Type.STRING },
          careerTrajectory: { type: Type.STRING }
        },
        required: ["quantifiedImpact", "scopeSeniorityAlignment", "careerTrajectory"]
      },
      redFlags: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      interviewProbes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            targetGap: { type: Type.STRING },
            question: { type: Type.STRING }
          },
          required: ["targetGap", "question"]
        }
      },
      reasoning_buffer: {
        type: Type.STRING,
        description: "A short chain-of-thought paragraph analyzing the gates, impacts, and flags to determine the final score and recommendation. Do this before outputting fitScore."
      },
      recommendation: {
        type: Type.STRING,
        description: "Exact recommendation based on the reasoning: 'STRONG PURSUE', 'CONDITIONAL SCREEN', or 'DO NOT ADVANCE'."
      },
      fitScore: {
        type: Type.INTEGER,
        description: "Overall candidate fit score from 0 to 100 based on the reasoning buffer."
      }
    },
    required: ["candidateName", "hardGates", "experienceImpact", "redFlags", "interviewProbes", "reasoning_buffer", "recommendation", "fitScore"]
  };

  let contents: Array<string | { inlineData: { data: string; mimeType: string } }>;

  if (typeof payload === 'string') {
    contents = [
      `${systemInstructions}\n\nCandidate Resume:\n${payload}`
    ];
  } else {
    const fileBase64 = Buffer.from(await payload.arrayBuffer()).toString('base64');
    const mimeType = payload.type || 'application/pdf';

    contents = [
      systemInstructions,
      {
        inlineData: {
          data: fileBase64,
          mimeType: mimeType
        }
      }
    ];
  }

  const generateWithModel = (model: string) =>
    ai.models.generateContent({
      model,
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.1,
      }
    });

  const isTransientError = (error: unknown): boolean => {
    if (!error) return false;
    const errObj = typeof error === 'object' ? (error as Record<string, unknown>) : null;
    const status = errObj?.status || errObj?.code || errObj?.statusCode;
    if (status === 503 || status === 429 || status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED') {
      return true;
    }
    const msg = error instanceof Error ? error.message : String(error);
    return (
      msg.includes('503') ||
      msg.includes('429') ||
      msg.includes('high demand') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('rate limit') ||
      msg.includes('quota') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT')
    );
  };

  const generateWithRetry = async (model: string, maxRetries = 2, baseDelayMs = 800) => {
    let attempt = 0;
    while (true) {
      try {
        return await generateWithModel(model);
      } catch (err: unknown) {
        attempt++;
        if (attempt > maxRetries || !isTransientError(err)) {
          throw err;
        }
        const jitter = Math.floor(Math.random() * 400);
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Evaluator] Transient error on ${model} (attempt ${attempt}/${maxRetries}): ${msg}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };

  const modelsToTry = [
    'gemini-flash-latest'
  ];

  let response;
  let lastError: Error | null = null;
  let structured: RawScorecard | undefined;

  for (const model of modelsToTry) {
    try {
      console.log(`[Evaluator] Attempting Pass 2 Evaluation with ${model}...`);
      response = await generateWithRetry(model, 1, 800);
      if (response?.text) {
        structured = parseGeminiResponse(response);
        break;
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Evaluator] Model ${model} failed. Trying next model...`, lastError.message);
    }
  }

  if (!structured) {
    const is503OrTransient = isTransientError(lastError) || String(lastError?.message || lastError).includes('503');
    if (process.env.OPENROUTER_API_KEY && (is503OrTransient || !lastError)) {
      console.warn(`[Evaluator] Primary Gemini models failed. Triggering OpenRouter fallback...`);
      try {
        structured = await generateViaOpenRouter(systemInstructions, payload, lastError);
      } catch (fallbackErr: unknown) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        console.error('[Evaluator] OpenRouter fallback also failed:', fallbackMsg);
      }
    }
  }

  if (!structured) {
    console.warn(`[Evaluator] Attempting absolute last resort fallback with gemini-flash-lite-latest...`);
    try {
      response = await generateWithRetry('gemini-flash-lite-latest', 1, 800);
      if (response?.text) {
        structured = parseGeminiResponse(response);
      }
    } catch (liteErr: unknown) {
      console.error('[Evaluator] Last resort Lite fallback failed:', liteErr instanceof Error ? liteErr.message : String(liteErr));
    }
  }

  if (!structured) {
    throw lastError || new Error("Failed to evaluate resume: All models and fallbacks failed.");
  }

  let recommendation: ScorecardRecommendation = 'UNKNOWN';
  const recUpper = (structured.recommendation || '').toUpperCase();
  if (recUpper.includes('STRONG PURSUE')) recommendation = 'STRONG PURSUE';
  else if (recUpper.includes('CONDITIONAL SCREEN')) recommendation = 'CONDITIONAL SCREEN';
  else if (recUpper.includes('DO NOT ADVANCE')) recommendation = 'DO NOT ADVANCE';

  const fitScore = typeof structured.fitScore === 'number'
    ? Math.min(100, Math.max(0, structured.fitScore))
    : 0;

  const markdown = buildScorecardMarkdown(structured, jobContext.title);

  return {
    candidateName: structured.candidateName || '',
    targetRole: jobContext.title,
    recommendation,
    fitScore,
    hardGates: structured.hardGates,
    experienceImpact: structured.experienceImpact,
    redFlags: structured.redFlags,
    interviewProbes: structured.interviewProbes,
    markdown,
  };
}
