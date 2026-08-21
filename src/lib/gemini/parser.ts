import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ParsedCandidate {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  primarySkills: string[];
  yearsOfExperience: number;
  summary: string;
  suggestedRoleFit: string;
}

export async function parseResumeData(payload: File | string): Promise<ParsedCandidate> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      firstName: { type: Type.STRING },
      lastName: { type: Type.STRING },
      email: { type: Type.STRING },
      phone: { type: Type.STRING },
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
    required: ["firstName", "lastName", "email", "phone", "primarySkills", "yearsOfExperience", "summary", "suggestedRoleFit"]
  };

  let contents: any[];

  if (typeof payload === 'string') {
    contents = [
      "You are an expert technical recruiter. Parse the following resume text and extract the candidate information according to the schema.\n\n" + payload
    ];
  } else {
    // It's a File object
    const fileBase64 = Buffer.from(await payload.arrayBuffer()).toString('base64');
    const mimeType = payload.type || 'application/pdf'; // fallback to pdf
    
    contents = [
      "You are an expert technical recruiter. Parse the attached resume document and extract the candidate information according to the schema.",
      {
        inlineData: {
          data: fileBase64,
          mimeType: mimeType
        }
      }
    ];
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
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
