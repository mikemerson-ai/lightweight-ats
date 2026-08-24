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
  summary: string;
  suggestedRoleFit: string;
}

export async function parseResumeData(payload: File | string, jobContext?: JobContext): Promise<ParsedCandidate> {
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
      summary: { 
        type: Type.STRING, 
        description: "A concise 2-sentence bio of the candidate." 
      },
      suggestedRoleFit: { 
        type: Type.STRING,
        description: "A suggested role based on the candidate's skills and experience."
      }
    },
    required: ["firstName", "lastName", "email", "phone", "address", "primarySkills", "yearsOfExperience", "summary", "suggestedRoleFit"]
  };

  let contents: any[];
  
  let instructions = "You are an expert technical recruiter. Parse the attached resume document and extract the candidate information according to the schema.";
  
  if (jobContext) {
    instructions += `\n\nCompare the candidate's experience strictly against the provided job description and requirements. The 'summary' MUST be a 2-sentence candidate overview highlighting relevance to this specific role. The 'suggestedRoleFit' MUST be a fit level rating (e.g., 'Strong Fit', 'Moderate Fit', 'Skill Gap') plus a brief explanation of why.\n\nJob Title: ${jobContext.title}\nJob Description: ${jobContext.description}\nJob Requirements: ${jobContext.requirements}`;
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
