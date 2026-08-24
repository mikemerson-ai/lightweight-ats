import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface JobContext {
  title: string;
  description: string;
  requirements: string;
}

export interface ParsedCandidate {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  primarySkills: string[];
  yearsOfExperience: number;
  fitSummary: string;
  fitRating: number;
  work_experience?: Array<{ jobTitle: string; company: string; dates: string; summary: string }>;
}

export async function parseResumeData(payload: File | string, jobContext?: JobContext): Promise<ParsedCandidate> {
  if (!jobContext?.title || !jobContext?.description || jobContext.description.trim().length === 0) {
    throw new Error("FATAL: Missing jobTitle or jobDescription in parseResume.");
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      firstName: { type: Type.STRING },
      lastName: { type: Type.STRING },
      email: { type: Type.STRING },
      phone: { type: Type.STRING },
      address: { type: Type.STRING },
      primarySkills: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      yearsOfExperience: { type: Type.NUMBER },
      fitSummary: {
        type: Type.STRING,
        description: "Objective 2-sentence paragraph. State total years of experience first, flag the missing role-specific requirements in sentence 1, and justify the rating in sentence 2."
      },
      fitRating: {
        type: Type.NUMBER,
        description: "1-5 stars."
      },
      work_experience: {
        type: Type.ARRAY,
        description: "Extract up to 3 of the most relevant past work experiences. Prioritize roles relevant to the Target Job Description; if none are relevant, use the 3 most recent. Summarize the duties into a concise 1-2 sentence overview.",
        items: {
          type: Type.OBJECT,
          properties: {
            jobTitle: { type: Type.STRING },
            company: { type: Type.STRING },
            dates: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: ["jobTitle", "company", "dates", "summary"]
        }
      }
    },
    required: ["firstName", "lastName", "email", "phone", "address", "primarySkills", "yearsOfExperience", "fitSummary", "fitRating"]
  };

  let contents: any[];

  let instructions = "You are an objective talent acquisition specialist evaluating a candidate against a target Job Title and Job Description.";

  if (jobContext) {
    instructions += `\n\nTarget Job Title: ${jobContext.title}\nTarget Job Description: ${jobContext.description}\nTarget Job Requirements: ${jobContext.requirements}\n\nUNIVERSAL SCORING RUBRIC (1 to 5 Stars):\n- 5 Stars (Exceptional Fit): Meets or exceeds core requirements, demonstrates substantial direct experience in the target role functions, and holds all mandatory certifications or licenses.\n- 4 Stars (Strong Fit): Significant direct experience in the core functional duties with strong domain relevance; meets primary qualifications with only minor preference gaps.\n- 3 Stars (Moderate / High-Potential Fit): Strong transferable domain knowledge and functional track record, but requires obtaining or renewing specific secondary certifications, tools, or niche credentials. Do NOT hard-cap strong transferable candidates at 2 stars if they possess proven core competencies.\n- 2 Stars (Weak Fit): Related industry or adjacent domain background, but lacks direct experience in the primary functional responsibilities outlined in the job description.\n- 1 Star (Mismatch): Unrelated background or fails to meet baseline minimum qualifications.\n\nEVALUATION RULES:\n1. Dynamic Grounding: Base evaluations strictly on the provided Target Job Title and Target Job Description.\n2. Balanced Weighting: Distinguish between trainable/acquirable certifications vs. core functional experience. Award 3/5 to candidates who have strong practical experience in adjacent or foundational duties even if minor credentials must be acquired on the job.\n3. fitSummary Structure (Strictly 2 Sentences):\n   - Sentence 1: Summarize total years of relevant experience, noting core strengths and any missing requirements or credentials.\n   - Sentence 2: Provide an objective rationale explaining the rating and the exact gaps needed to reach full alignment.`;
  } else {
    instructions += "\n\nParse the attached resume document and extract the candidate information according to the schema.";
  }

  if (typeof payload === 'string') {
    contents = [
      `${instructions}\n\nCandidate Resume:\n${payload}`
    ];
  } else {
    // It's a File object
    const fileBase64 = Buffer.from(await payload.arrayBuffer()).toString('base64');
    const mimeType = payload.type || 'application/pdf'; // fallback to pdf

    contents = [
      instructions,
      {
        inlineData: {
          data: fileBase64,
          mimeType: mimeType
        }
      }
    ];
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.1, // Low temperature for more deterministic extraction
    }
  });

  if (!response.text) {
    throw new Error("Failed to parse resume: No response text from Gemini");
  }

  try {
    const parsed = JSON.parse(response.text) as ParsedCandidate;
    return parsed;
  } catch (err) {
    throw new Error("Failed to parse resume: Invalid JSON response");
  }
}
