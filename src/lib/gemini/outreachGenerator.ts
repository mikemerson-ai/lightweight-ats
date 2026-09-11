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
  subject: string;
  body: string;
  keyHighlights?: string[];
  callToAction: string;
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
      "Write with genuine enthusiasm, personality, and human warmth. Build rapport while remaining articulate and respectful.",
    concise:
      "Keep it brief, punchy, and modern (under 120 words). Cut filler words and get straight to why their profile stood out and the value proposition.",
  };

  const channelGuidelines: Record<OutreachChannel, string> = {
    email:
      "Format as a high-converting recruiter cold email. Provide an engaging, relevant subject line (under 60 chars, avoid spam triggers). Use 2-3 short paragraphs, clear spacing, and a professional closing.",
    linkedin:
      "Format as a LinkedIn InMail or connection message. Provide a concise, intriguing message subject/headline. Keep the body conversational, mobile-friendly, and under 150 words.",
    indeed:
      "Format as an Indeed direct candidate message. Reference the job posting clearly, note what in their profile caught the recruiter's eye, and invite them to discuss next steps.",
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

  const prompt = `You are an elite, top-tier tech and executive recruiter craft outreach messages that candidates actually open, read, and reply to.

YOUR OBJECTIVE:
Generate a bespoke, high-converting candidate outreach message tailored specifically to this candidate and target role.

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

GOLDEN RULES FOR THE OUTREACH:
1. NEVER sound like a generic mass-blast bot. Pinpoint 1-2 real specifics from their experience (e.g. past companies, projects, or skill overlap).
2. Clearly explain WHY this specific role is a compelling next step for them.
3. Keep the Call to Action (CTA) low friction (e.g., "Open to a brief 10-minute introductory chat this week?", not "Send me your availability for a 1-hour interview").
4. Use the candidate's first name in the greeting.
5. Sign off cleanly with the recruiter's name.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      subject: {
        type: Type.STRING,
        description: "Compelling, high-open-rate subject line or message headline.",
      },
      body: {
        type: Type.STRING,
        description:
          "The complete personalized message body ready to send or copy, including greeting and sign-off.",
      },
      keyHighlights: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          "2-3 specific background points or skills referenced to personalize the message.",
      },
      callToAction: {
        type: Type.STRING,
        description: "The closing call to action sentence.",
      },
    },
    required: ["subject", "body", "callToAction"],
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
    console.warn(
      "Fallback to gemini-3.5-flash-lite for outreach message generation:",
      error
    );
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
    subject: parsed.subject || `Opportunity: ${jobTitle} role at ${companyName}`,
    body: parsed.body || "",
    keyHighlights: parsed.keyHighlights || [],
    callToAction: parsed.callToAction || "Open to connecting for a quick chat?",
    channel,
    tone,
  };
}
