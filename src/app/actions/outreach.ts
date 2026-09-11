"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  generateOutreachMessage,
  type OutreachChannel,
  type OutreachTone,
  type OutreachResult,
} from "@/lib/gemini/outreachGenerator";

export interface GenerateOutreachActionInput {
  candidateId: string;
  channel: OutreachChannel;
  tone: OutreachTone;
  customPrompt?: string;
  recruiterName?: string;
}

export interface GenerateOutreachActionResult {
  success: boolean;
  outreach?: OutreachResult;
  candidateEmail?: string;
  candidateLinkedIn?: string;
  error?: string;
}

export async function generateCandidateOutreachAction(
  input: GenerateOutreachActionInput
): Promise<GenerateOutreachActionResult> {
  try {
    const { candidateId, channel, tone, customPrompt, recruiterName } = input;

    if (!candidateId) {
      return { success: false, error: "Candidate ID is required" };
    }

    const supabase = await createClient();

    // 1. Fetch candidate and job
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("*, jobs(id, title, description, requirements)")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      return { success: false, error: "Candidate record not found" };
    }

    const job = candidate.jobs as {
      id: string;
      title: string;
      description?: string;
      requirements?: string;
    } | null;

    const jobTitle = job?.title || "Target Role";
    const jobDescription = [job?.description, job?.requirements]
      .filter(Boolean)
      .join("\n\n");

    const candidateName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || "Candidate";

    // 2. Generate outreach via Gemini
    const outreach = await generateOutreachMessage({
      candidateName,
      candidateEmail: candidate.email,
      candidateSkills: candidate.primary_skills,
      candidateSummary: candidate.ai_summary,
      candidateWorkExperience: candidate.work_experience,
      resumeSnippet: candidate.resume_text,
      jobTitle,
      jobDescription,
      companyName: "our team",
      recruiterName: recruiterName || "Recruiter",
      channel,
      tone,
      customPrompt,
    });

    return {
      success: true,
      outreach,
      candidateEmail: candidate.email || undefined,
      candidateLinkedIn: candidate.linkedin_url || undefined,
    };
  } catch (error: any) {
    console.error("Error generating candidate outreach:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred while generating outreach.",
    };
  }
}

export interface LogOutreachActionInput {
  candidateId: string;
  channel: OutreachChannel;
  subject: string;
  body: string;
  recruiterName?: string;
}

export async function logCandidateOutreachActivity(
  input: LogOutreachActionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { candidateId, channel, subject, body, recruiterName } = input;

    const supabase = await createClient();

    const channelLabels: Record<OutreachChannel, string> = {
      email: "Email",
      linkedin: "LinkedIn InMail",
      indeed: "Indeed Message",
    };

    const preview = body.length > 200 ? body.slice(0, 200) + "..." : body;

    await supabase.from("activity_logs").insert({
      candidate_id: candidateId,
      activity_type: `Outreach Sent (${channelLabels[channel] || channel})`,
      notes: `Subject: ${subject}\n\n${preview}`,
      author_name: recruiterName || "Recruiter",
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Error logging outreach activity:", error);
    return { success: false, error: error.message || "Failed to log outreach activity" };
  }
}
