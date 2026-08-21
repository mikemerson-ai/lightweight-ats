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
  email?: string;
  phone?: string;
  primary_skills?: string;
  years_of_experience?: number | null;
  ai_summary?: string | null;
  suggested_role_fit?: string | null;
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
  contact_info: string;
  source_channel: string;
  source_type: string;
  pending_resume: boolean;
  years_of_experience?: number | null;
  ai_summary?: string | null;
  suggested_role_fit?: string | null;
  created_at: string;
  updated_at: string;
  jobs: { title: string } | null;
}

export interface ActivityLogEntry {
  id: string;
  candidate_id: string;
  activity_type: string;
  notes: string | null;
  created_at: string;
}

export interface ComplianceDocument {
  id: string;
  candidate_id: string;
  category: string;
  item_name: string;
  status: string;
  issued_date?: string | null;
  expires_at?: string | null;
}

export async function getCandidateActivity(
  candidateId: string,
): Promise<ActivityLogEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ActivityLogEntry[]) ?? [];
}

export async function getCandidateDocuments(
  candidateId: string,
): Promise<ComplianceDocument[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document_checklists")
    .select("*")
    .eq("candidate_id", candidateId);

  if (error) {
    throw new Error(error.message);
  }

  return (data as ComplianceDocument[]) ?? [];
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
      email: data.email,
      phone: data.phone,
      primary_skills: data.primary_skills,
      years_of_experience: data.years_of_experience,
      ai_summary: data.ai_summary,
      suggested_role_fit: data.suggested_role_fit,
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

export async function getCandidatesByJob(jobId: string): Promise<Candidate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("candidates")
    .select("*, jobs(title)")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as Candidate[]) ?? [];
}

export async function updateCandidateStage(
  candidateId: string,
  stage: string,
  disqualificationReason?: string,
): Promise<void> {
  const supabase = await createClient();

  const updateData: any = { current_stage: stage };
  if (disqualificationReason) {
    updateData.disqualification_reason = disqualificationReason;
  }

  const { error } = await supabase
    .from("candidates")
    .update(updateData)
    .eq("id", candidateId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function checkCandidateCompliance(
  candidateId: string,
): Promise<{ compliant: boolean; missing_items?: string[] }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_candidate_compliance_status", {
    candidate_uuid: candidateId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    compliant: data?.compliant ?? false,
    missing_items: data?.missing_items ?? [],
  };
}