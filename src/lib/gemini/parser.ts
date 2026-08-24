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
      fitSummary: { 
        type: Type.STRING, 
        description: "Objective 2-sentence paragraph. State total years of experience first. Immediately flag any missing mandatory skills or gaps. Briefly explain the rating." 
      },
      fitRating: { 
        type: Type.NUMBER,
        description: "1-5 stars (5 = exact keyword matches and mandatory requirements met; weigh transferable skills favorably)."
      }
    },
    required: ["firstName", "lastName", "email", "phone", "address", "primarySkills", "yearsOfExperience", "fitSummary", "fitRating"]
  };

  let contents: any[];
  
  let instructions = "You are an expert technical recruiter. Parse the attached resume document and extract the candidate information according to the schema.";
  
  if (jobContext) {
    instructions += `\n\nEvaluate the candidate strictly against the Job Title and Description.\n\nJob Title: ${jobContext.title}\nJob Description: ${jobContext.description}\nJob Requirements: ${jobContext.requirements}`;
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
