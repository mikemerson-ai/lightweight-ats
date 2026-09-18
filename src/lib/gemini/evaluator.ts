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

function is503Error(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const code = (error as { code?: number | string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    status === 503 ||
    code === 503 ||
    lower.includes('503') ||
    lower.includes('overloaded')
  );
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

const OPENROUTER_FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
];

const OPENROUTER_STRICT_JSON_MANDATE =
  'Respond with raw JSON only matching the schema. Do not include markdown code fences, backticks, or any conversational text.';

const OPENROUTER_JSON_INSTRUCTION = `Return ONLY valid JSON (no markdown fences, no additional commentary) that exactly matches this shape:
{
  "candidateName": string,
  "recommendation": "STRONG PURSUE" | "CONDITIONAL SCREEN" | "DO NOT ADVANCE",
  "fitScore": integer between 0 and 100,
  "hardGates": [ { "requirement": string, "status": "Match" | "Partial" | "Missing", "evidence": string } ],
  "experienceImpact": { "quantifiedImpact": string, "scopeSeniorityAlignment": string, "careerTrajectory": string },
  "redFlags": [ string ],
  "interviewProbes": [ { "targetGap": string, "question": string } ]
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
  return `[Binary resume file "${payload.name}" (${payload.type || 'application/octet-stream'}) — OpenRouter free text models cannot parse binary content]`;
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
      models: OPENROUTER_FREE_MODELS,
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

  const systemInstructions = `# Role & Purpose
You are an expert Technical Recruiter and Talent Acquisition Lead. Your task is to objectively evaluate candidate resumes against a provided Job Description (JD) and produce an unbiased, evidence-backed evaluation scorecard.

# Operational Principles
1. **Zero Hallucination:** Only evaluate skills, tools, and experiences explicitly documented in the resume. If an item is not mentioned, score it as "Not Evident" or "Missing".
2. **Impact over Buzzwords:** Prioritize candidates whose achievements reflect scope, metric-driven business outcomes (CAR/STAR/XYZ framework), and clear organizational ownership.
3. **No Inference of Equivalency:** Do not assume a candidate knows a core required tool simply because they know a tangential framework, unless explicitly stated.

# Input Context
- Target Job Title: ${jobContext.title}
- Target Job Description: ${jobContext.description}
- Target Job Requirements: ${jobContext.requirements || 'Standard requirements as outlined in description'}

# Evaluation Rubric
- recommendation must be one of: "STRONG PURSUE", "CONDITIONAL SCREEN", "DO NOT ADVANCE".
- fitScore must be an integer between 0 and 100.
- hardGates: 3 to 5 core non-negotiable requirements evaluated with exact evidence/quotes.
- experienceImpact: assess quantified outcomes, seniority alignment, and career trajectory.
- redFlags: list 1-3 specific gaps or flags.
- interviewProbes: 2-3 targeted recruiter screening drill-down questions.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      candidateName: { type: Type.STRING },
      recommendation: {
        type: Type.STRING,
        description: "Exact recommendation: 'STRONG PURSUE', 'CONDITIONAL SCREEN', or 'DO NOT ADVANCE'."
      },
      fitScore: {
        type: Type.INTEGER,
        description: "Overall candidate fit score from 0 to 100."
      },
      hardGates: {
        type: Type.ARRAY,
        description: "3-5 core non-negotiable requirements.",
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
      }
    },
    required: ["candidateName", "recommendation", "fitScore", "hardGates", "experienceImpact", "redFlags", "interviewProbes"]
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

  let structured: RawScorecard;

  try {
    structured = parseGeminiResponse(await generateWithModel('gemini-3.6-flash'));
  } catch (primaryError) {
    if (!is503Error(primaryError)) {
      throw primaryError;
    }
    console.warn('503 caught on 3.6 Flash. Falling back to 3.5 Flash...');

    try {
      structured = parseGeminiResponse(await generateWithModel('gemini-3.5-flash'));
    } catch (secondaryError) {
      console.warn('Gemini unavailable (503). Successfully fell back to OpenRouter free models.');
      structured = await generateViaOpenRouter(systemInstructions, payload, secondaryError);
    }
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
