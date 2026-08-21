"use server";

import { createClient } from "@/lib/supabase/server";

export const SOURCING_CHANNELS = [
  "LinkedIn Recruiter",
  "Indeed Resume Database",
  "Employee Referral",
  "Headhunter / Agency",
  "Talent Pool Rediscovery",
] as const;

export type SourcingChannel = (typeof SOURCING_CHANNELS)[number];

export interface QuickAddSourcedCandidateInput {
  first_name: string;
  last_name: string;
  source_channel: SourcingChannel;
  job_id: string;
  contact_info: string;
  outreach_notes?: string;
}

export interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  primary_skills: string;
  status_tag: string;
  current_stage: string;
  job_id: string;
  jobs: { title: string } | null;
}

export async function searchCandidates(query: string): Promise<Candidate[]> {
  const supabase = await createClient();

  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const { data, error } = await supabase
    .from("candidates")
    .select("*, jobs(title)")
    .or(
      `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,primary_skills.ilike.%${trimmed}%,status_tag.ilike.%${trimmed}%`,
    )
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data as Candidate[]) ?? [];
}

export async function quickAddSourcedCandidate(
  data: QuickAddSourcedCandidateInput,
): Promise<Candidate> {
  const supabase = await createClient();

  const { data: candidate, error } = await supabase
    .from("candidates")
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      current_stage: "new_application",
      source_channel: data.source_channel,
      source_type: "outbound",
      job_id: data.job_id,
      contact_info: data.contact_info,
      pending_resume: true,
    })
    .select("*, jobs(title)")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (data.outreach_notes) {
    const { error: logError } = await supabase.from("activity_logs").insert({
      candidate_id: candidate.id,
      activity_type: "outreach_note",
      notes: data.outreach_notes,
    });

    if (logError) {
      throw new Error(logError.message);
    }
  }

  return candidate as Candidate;
}