import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type OutreachChannel = "email" | "linkedin" | "indeed";
export type OutreachTone = "professional" | "warm" | "concise";

export interface GenerateOutreachInput {
  candidateName: string;
  candidateEmail?: string;
  candidateSkills?: string;
  candidateSummary?: string;
  candidateWorkExperience?: Array<{
    jobTitle?: string;
    company?: string;
    dates?: string;
    summary?: string;
  }>;
  resumeSnippet?: string;
  jobTitle: string;
  jobDescription?: string;
  companyName?: string;
  recruiterName?: string;
  channel: OutreachChannel;
  tone: OutreachTone;
  customPrompt?: string;
}

export interface OutreachResult {
  sourcingIntelligence: {
    candidateHook: string;
    targetValueProp: string;
  };
  initialMessage: {
    subject: string;
    body: string;
    callToAction: string;
  };
  followUpNudge: {
    subject: string;
    body: string;
  };
  channel: OutreachChannel;
  tone: OutreachTone;
}

export async function generateOutreachMessage(
  input: GenerateOutreachInput
): Promise<OutreachResult> {
  const {
    candidateName,
    candidateSkills,
    candidateSummary,
    candidateWorkExperience,
    resumeSnippet,
    jobTitle,
    jobDescription,
    companyName = "our team",
    recruiterName = "Recruiter",
    channel,
    tone,
    customPrompt,
  } = input;

  const toneGuidelines: Record<OutreachTone, string> = {
    professional:
      "Maintain a polished, executive, and business-focused tone. Highlight clear career progression and alignment with role responsibilities.",
    warm:
      "Write with genuine enthusiasm, personality, and human warmth. Build rapport while remaining articulate and respectful. Avoid cheesy flattery.",
    concise:
      "Keep it ultra-brief, punchy, and modern (under 75 words). Peer-to-peer / engineer-to-engineer style. Cut filler words and get straight to the technical problem.",
  };

  const channelGuidelines: Record<OutreachChannel, string> = {
    email:
      "Format as a high-converting recruiter cold email (75-125 words). Provide an engaging, relevant subject line (under 60 chars, avoid spam triggers). Use 2-3 short paragraphs, clear spacing.",
    linkedin:
      "Format as a LinkedIn InMail or connection message (<85 words). Provide a concise, intriguing message headline. Keep the body conversational and mobile-friendly.",
    indeed:
      "Format as an Indeed direct candidate message (75-110 words). Reference the job posting clearly, note what in their resume caught your eye over other applicants, invite them to explore.",
  };

  let experienceSummary = "";
  if (candidateWorkExperience && candidateWorkExperience.length > 0) {
    experienceSummary = candidateWorkExperience
      .slice(0, 3)
      .map(
        (exp) =>
          `- ${exp.jobTitle || "Role"} at ${exp.company || "Company"} (${exp.dates || "Dates"}): ${exp.summary || ""}`
      )
      .join("\n");
  }

  const prompt = `You are an elite Talent Sourcing Specialist and Executive Search Consultant. 
Your task is to generate high-converting, personalized candidate outreach messages by cross-referencing a Target Job Description against a Candidate Profile.

CORE TENETS & ANTI-PATTERNS (CRITICAL INSTRUCTIONS):
1. Zero Generic Fluff: NEVER use phrases like "I hope this email finds you well," "I came across your impressive profile," or "You seem like a great fit."
2. The "One Concrete Artifact" Rule: The email MUST cite at least one specific technical or business accomplishment from the candidate's background (e.g., a specific stack migration, team expansion, or metric achieved) to prove genuine personalization.
3. WIIFM (What's In It For Them): Position the role as a logical next step, compelling career challenge, or high-scale technical problem, not just a list of hiring requirements.
4. Low-Friction Call-to-Action (CTA): End with a casual, zero-pressure conversation starter (e.g., "Open to a brief chat next week?" or "Worth a quick exchange?"). NO calendar links.
5. Elite Recruiter Anti-Patterns:
   - NO mentioning salary/comp too early unless explicitly requested in custom instructions.
   - NO fake deadlines or aggressive timelines ("Please reply by Friday", "Urgent requirement").
   - NO desperation. Maintain equal business stature.

TARGET ROLE:
Title: ${jobTitle}
Company: ${companyName}
Job Description Overview:
${jobDescription || "Not provided - focus on typical core skills for " + jobTitle}

CANDIDATE BACKGROUND:
Name: ${candidateName}
Key Skills: ${candidateSkills || "Not specified"}
Profile Summary: ${candidateSummary || "Not specified"}
Recent Experience:
${experienceSummary || "Not specified"}
${resumeSnippet ? `\nResume Excerpt:\n${resumeSnippet.slice(0, 1500)}` : ""}

SENDER:
Recruiter Name: ${recruiterName}

PARAMETERS:
- Outreach Channel: ${channel.toUpperCase()} (${channelGuidelines[channel]})
- Desired Tone: ${tone.toUpperCase()} (${toneGuidelines[tone]})
${customPrompt ? `- Recruiter Custom Instructions: ${customPrompt}` : ""}

EXECUTION WORKFLOW:
1. Signal Extraction: Find the most high-signal proof point from the candidate's profile (the Hook) and the primary value hook from the JD (Target Value Prop).
2. Generate Initial Message: Apply the tenets and constraints to write the main outreach.
3. Generate Follow-Up Nudge: Write a 30-50 word lightweight second touchpoint (Day 4 Nudge) referencing the original message and candidate hook, designed primarily for Email/InMail.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      sourcingIntelligence: {
        type: Type.OBJECT,
        properties: {
          candidateHook: {
            type: Type.STRING,
            description: "Specific project, tool, or achievement selected from profile.",
          },
          targetValueProp: {
            type: Type.STRING,
            description: "The specific challenge/opportunity in the JD matched to this hook.",
          },
        },
        required: ["candidateHook", "targetValueProp"],
      },
      initialMessage: {
        type: Type.OBJECT,
        properties: {
          subject: {
            type: Type.STRING,
            description: "Compelling, high-open-rate subject line or message headline.",
          },
          body: {
            type: Type.STRING,
            description: "The complete personalized message body ready to send or copy.",
          },
          callToAction: {
            type: Type.STRING,
            description: "The closing low-friction call to action sentence.",
          },
        },
        required: ["subject", "body", "callToAction"],
      },
      followUpNudge: {
        type: Type.OBJECT,
        properties: {
          subject: {
            type: Type.STRING,
            description: "Subject line for the follow-up, usually starting with 'Re: '",
          },
          body: {
            type: Type.STRING,
            description: "A 30-50 word follow up message to send on Day 4.",
          },
        },
        required: ["subject", "body"],
      },
    },
    required: ["sourcingIntelligence", "initialMessage", "followUpNudge"],
  };

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [prompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
      },
    });
  } catch (error) {
    console.warn("Fallback to gemini-3.5-flash-lite for outreach message generation:", error);
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [prompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
      },
    });
  }

  const rawText = response?.text || "";
  const parsed = JSON.parse(rawText || "{}");

  return {
    sourcingIntelligence: parsed.sourcingIntelligence || { candidateHook: "", targetValueProp: "" },
    initialMessage: parsed.initialMessage || { subject: "", body: "", callToAction: "" },
    followUpNudge: parsed.followUpNudge || { subject: "", body: "" },
    channel,
    tone,
  };
}
