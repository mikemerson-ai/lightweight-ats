import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface JobEvaluationContext {
  title: string;
  description: string;
  requirements?: string;
}

export type ScorecardRecommendation = 'STRONG PURSUE' | 'CONDITIONAL SCREEN' | 'DO NOT ADVANCE' | 'UNKNOWN';

export interface ScorecardResult {
  candidateName: string;
  targetRole: string;
  recommendation: ScorecardRecommendation;
  fitScore: number;
  markdown: string;
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
1. **Zero Hallucination:** Only evaluate skills, tools, and experiences explicitly documented in the resume. If an item is not mentioned, score it as "Not Evident."
2. **Impact over Buzzwords:** Prioritize candidates whose achievements reflect scope, metric-driven business outcomes (CAR/STAR/XYZ framework), and clear organizational ownership.
3. **No Inference of Equivalency:** Do not assume a candidate knows a core required tool simply because they know a tangential framework, unless explicitly stated.

# Input Requirements
- Target Job Title: ${jobContext.title}
- Target Job Description: ${jobContext.description}
- Target Job Requirements: ${jobContext.requirements || 'Standard requirements as outlined in description'}

# Execution Workflow
1. **Deconstruct the Role:**
   - Extract up to 5 Non-Negotiable Requirements (Hard Gates).
   - Extract up to 5 Preferred / Value-Add Qualifications.
2. **Evaluate Evidence & Match Scoring:**
   - Check every bullet against the requirements.
   - Categorize each requirement as: \`Strong Match\`, \`Partial Match\`, or \`Missing / Not Evident\`.
   - Cite direct quote snippets from the resume as evidence for every match.
3. **Analyze Career Trajectory & Longevity:**
   - Assess tenure stability, progression (promotions, expanded scope), and role continuity.
4. **Generate Screening Recommendation:**
   - Categorize the candidate into one of three action buckets:
     - **STRONG PURSUE:** Meets 100% of core non-negotiables with strong quantified outcomes.
     - **CONDITIONAL SCREEN:** Meets most core criteria, but has 1–2 specific gaps requiring recruiter phone inquiry.
     - **DO NOT ADVANCE:** Fails one or more hard gates or lacks baseline foundational scope.

# Structured Output Format
Always structure the evaluation using the following Markdown template without wrapping in JSON:

## Candidate Screening Summary
- **Candidate Name:** [Extracted Name]
- **Target Role:** ${jobContext.title}
- **Match Recommendation:** [STRONG PURSUE / CONDITIONAL SCREEN / DO NOT ADVANCE]
- **Overall Fit Score:** [X/100]

### 1. Hard Gate Requirements Check
| Non-Negotiable Requirement | Status (Match / Partial / Missing) | Exact Evidence / Resume Snippet |
| :--- | :--- | :--- |
| [Requirement 1] | [Status] | "[Quote from resume]" |
| [Requirement 2] | [Status] | "[Quote from resume]" |

### 2. Experience & Impact Analysis
- **Quantified Impact (XYZ/STAR):** [Assessment of whether bullets contain numbers, percentages, and clear ownership]
- **Scope & Seniority Alignment:** [Assessment of candidate level vs. job requirements]
- **Career Trajectory:** [Observations on tenure, promotions, and progression]

### 3. Red Flags & Knowledge Gaps
- [Flag or gap 1 with explanation]
- [Flag or gap 2 with explanation]

### 4. Recruiter Interview Probes (If Advancing)
Formulate 2-3 behavioral or technical drill-down questions targeting ambiguities or partial matches:
1. *[Target Gap/Ambiguity]*: "[Targeted question to ask during phone screen]"
2. *[Target Gap/Ambiguity]*: "[Targeted question to ask during phone screen]"
`;

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

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        temperature: 0.1,
      }
    });
  } catch (error) {
    // Fallback to flash-lite if 2.5-flash is unavailable
    console.warn('Fallback to gemini-3.5-flash-lite for scorecard generation:', error);
    response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: contents,
      config: {
        temperature: 0.1,
      }
    });
  }

  const markdown = response.text || '';
  if (!markdown) {
    throw new Error('Failed to generate scorecard: No response text received from Gemini');
  }

  // Parse structured details out of markdown
  const recMatch = markdown.match(/Match Recommendation:\s*\*?\*?\s*(STRONG PURSUE|CONDITIONAL SCREEN|DO NOT ADVANCE)/i);
  let recommendation: ScorecardRecommendation = 'UNKNOWN';
  if (recMatch) {
    const recStr = recMatch[1].toUpperCase();
    if (recStr.includes('STRONG PURSUE')) recommendation = 'STRONG PURSUE';
    else if (recStr.includes('CONDITIONAL SCREEN')) recommendation = 'CONDITIONAL SCREEN';
    else if (recStr.includes('DO NOT ADVANCE')) recommendation = 'DO NOT ADVANCE';
  }

  const scoreMatch = markdown.match(/Overall Fit Score:\s*\*?\*?\s*(\d{1,3})/i);
  const fitScore = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 0;

  const nameMatch = markdown.match(/Candidate Name:\s*\*?\*?\s*([^\n\r]+)/i);
  const candidateName = nameMatch ? nameMatch[1].replace(/[*\[\]]/g, '').trim() : '';

  return {
    candidateName,
    targetRole: jobContext.title,
    recommendation,
    fitScore,
    markdown,
  };
}
