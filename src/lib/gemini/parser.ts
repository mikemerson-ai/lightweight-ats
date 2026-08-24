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
        description: "1-5 stars (if mandatory core skills for the role are missing, cap the fitRating at a maximum of 2)."
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
  
  let instructions = "You are an expert technical recruiter. Parse the attached resume document and extract the candidate information according to the schema.";
  
  if (jobContext) {
    instructions += `\n\nEvaluate the candidate strictly against the Target Job Description provided. Do NOT evaluate them for their past industry or unrelated strengths. If mandatory core skills for the role (e.g., training facilitation, onboarding, new hire orientation, required certifications) are missing, flag it immediately as a critical gap and cap the fitRating at a maximum of 2.\n\nJob Title: ${jobContext.title}\nJob Description: ${jobContext.description}\nJob Requirements: ${jobContext.requirements}`;
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
