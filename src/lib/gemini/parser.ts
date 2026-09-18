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
  met_in_resume: boolean;
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
  work_experience?: Array<{ jobTitle: string; company: string; dates: string; summary: string }>;
  jdMinimumExperienceMet?: boolean;
  dynamicRequirementsCheck?: DynamicRequirementCheck[];
  criticalGaps?: string[];
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
  rawResumeText?: string;
  work_experience?: Array<{ jobTitle: string; company: string; dates: string; summary: string }>;
}

const INTAKE_INSTRUCTIONS =
  "You are a strict intake auditor performing a factual job analysis. " +
  "First, extract the 3 to 5 most critical mandatory requirements from the provided Job Description. " +
  "Second, evaluate the Resume to see if those requirements are explicitly met. " +
  "Do not assume or infer qualifications. If a requirement is not explicitly stated in the resume text, set met_in_resume to false and add it to critical_gaps. " +
  "Provide exact quotes for verified items.";

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
    const met = list.filter((c) => c.met_in_resume).length;
    return Math.max(1, Math.min(5, Math.round((met / list.length) * 5)));
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
        items: { type: Type.STRING }
      },
      years_of_experience: {
        type: Type.NUMBER,
        description: "Total years of professional experience, calculated from the candidate's resume work history."
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
        description: "3 to 5 critical mandatory requirements extracted from the Job Description, each evaluated against the resume.",
        items: {
          type: Type.OBJECT,
          properties: {
            requirement_extracted_from_jd: { type: Type.STRING, description: "A specific mandatory requirement stated in the Job Description." },
            met_in_resume: { type: Type.BOOLEAN },
            evidence_quote: {
              type: Type.STRING,
              nullable: true,
              description: "Exact string excerpt from the resume that proves the requirement, or null when met_in_resume is false."
            }
          },
          required: ["requirement_extracted_from_jd", "met_in_resume", "evidence_quote"]
        }
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
      "summary"
    ]
  };

  const jobDescriptionText =
    `Target Job Title: ${jobContext.title}\n` +
    `Target Job Description: ${jobContext.description}\n` +
    `Target Job Requirements: ${jobContext.requirements || ''}`;

  let contents: any[];

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

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
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

  let raw: RawIntakeOutput;
  try {
    raw = JSON.parse(response.text) as RawIntakeOutput;
  } catch (err) {
    throw new Error("Failed to parse resume: Invalid JSON response");
  }

  const subScores = computeSubScores(raw);
  const fitRating = computeFitRating(subScores);

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
    jdMinimumExperienceMet: raw.jd_minimum_experience_met,
    dynamicRequirementsCheck: raw.dynamic_requirements_check,
    criticalGaps: raw.critical_gaps,
  };

  if (typeof payload === 'string' && !parsed.rawResumeText) {
    parsed.rawResumeText = payload;
  }
  if (!parsed.zip_code && parsed.address) {
    parsed.zip_code = extractZipCode(parsed.address);
  }

  return parsed;
}