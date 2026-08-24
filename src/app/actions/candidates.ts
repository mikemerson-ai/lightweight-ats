"use server";

import { createClient } from "@/lib/supabase/server";

import { SourcingChannel } from "@/lib/constants";

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
  notes?: string;
  linkedin_url?: string;
  source_type?: string;
  pending_resume?: boolean;
  date_applied?: string;
  date_sourced?: string;
  author_name?: string;
}

export interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  primary_skills: string;
  status_tag: string;
  pipeline_stage: string;
  job_id: string;
  contact_info: string;
  source_channel: string;
  source_type: string;
  pending_resume: boolean;
  linkedin_url?: string;
  years_of_experience?: number | null;
  ai_summary?: string | null;
  suggested_role_fit?: string | null;
  created_at: string;
  updated_at: string;
  date_applied?: string;
  date_sourced?: string;
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
      pipeline_stage: "new_application",
      source_channel: data.source_channel,
      source_type: data.source_type || "outbound",
      job_id: data.job_id,
      contact_info: data.contact_info,
      linkedin_url: data.linkedin_url,
      email: data.email,
      phone: data.phone,
      primary_skills: data.primary_skills,
      years_of_experience: data.years_of_experience,
      ai_summary: data.ai_summary,
      suggested_role_fit: data.suggested_role_fit,
      pending_resume: data.pending_resume ?? true,
      date_applied: data.date_applied,
      date_sourced: data.date_sourced,
    })
    .select("*, jobs(title)")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const logPayload = {
    candidate_id: candidate.id,
    activity_type: "Candidate Created",
    notes: data.notes || "Candidate profile created",
    author_name: data.author_name || "Recruiter",
  };

  const { error: createLogError } = await supabase
    .from("activity_logs")
    .insert(logPayload);

  if (createLogError) {
    throw new Error(createLogError.message);
  }

  if (data.outreach_notes) {
    const { error: logError } = await supabase.from("activity_logs").insert({
      candidate_id: candidate.id,
      activity_type: "outreach_note",
      notes: data.outreach_notes,
      author_name: data.author_name || "Recruiter",
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

  const updateData: any = { pipeline_stage: stage };

  const { error } = await supabase
    .from("candidates")
    .update(updateData)
    .eq("id", candidateId);

  if (error) {
    throw new Error(error.message);
  }

  let notes = `Moved to ${stage}`;
  if (stage === "disqualified" && disqualificationReason) {
    notes += `. Reason: ${disqualificationReason}`;
  } else if (disqualificationReason) {
    notes += `. Reason: ${disqualificationReason}`;
  }

  await supabase.from("activity_logs").insert({
    candidate_id: candidateId,
    activity_type: "Stage Change",
    notes: notes,
  });
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

export async function deleteCandidate(candidateId: string): Promise<void> {
  const supabase = await createClient();

  // Delete associated records manually to ensure they are removed if cascading deletes aren't configured
  await supabase.from("activity_logs").delete().eq("candidate_id", candidateId);
  await supabase.from("document_checklists").delete().eq("candidate_id", candidateId);
  await supabase.from("evaluations").delete().eq("candidate_id", candidateId);

  const { error } = await supabase.from("candidates").delete().eq("id", candidateId);

  if (error) {
    throw new Error(error.message);
  }
  
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");
}