"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CandidateDocument } from "@/types/documents";
import type { ParsedCandidate } from "@/lib/gemini/parser";

import { SourcingChannel } from "@/lib/constants";

const HIRED_STAGE = "hired";
const DISQUALIFIED_STAGE = "disqualified";

const DISQUALIFICATION_REASONS = [
  "Did not meet requirements",
  "Missing qualifications",
  "Salary Mismatch",
  "Location/Commute",
  "Other",
];

export interface StageTransitionResult {
  success: boolean;
  blocked?: boolean;
  missingDocs?: string[];
  expiredDocs?: string[];
  error?: string;
}

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
  fit_rating?: number | null;
  outreach_notes?: string;
  notes?: string;
  linkedin_url?: string;
  source_type?: string;
  pending_resume?: boolean;
  date_applied?: string;
  date_sourced?: string;
  author_name?: string;
  address?: string;
  work_experience?: Array<{ jobTitle: string; company: string; dates: string; summary: string }>;
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
  fit_rating?: number | null;
  created_at: string;
  updated_at: string;
  date_applied?: string;
  date_sourced?: string;
  dnh_flag?: boolean;
  dnh_reason?: string | null;
  dnh_date?: string | null;
  dnh_recruiter?: string | null;
  jobs: { title: string } | null;
  address?: string;
  work_experience?: Array<{ jobTitle: string; company: string; dates: string; summary: string }>;
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

export async function checkCandidateDuplicate(
  firstName: string,
  lastName: string,
  email?: string,
  targetJobId?: string
): Promise<{
  isDuplicate: boolean;
  sameJob: boolean;
  existingRecord?: Partial<Candidate>;
}> {
  const supabase = await createClient();

  const isInvalidEmail = !email || !email.trim() || ["not provided", "not available", "n/a"].includes(email.trim().toLowerCase());
  const validEmail = isInvalidEmail ? null : email?.trim();
  const validFirstName = firstName?.trim();
  const validLastName = lastName?.trim();

  if (!validEmail && (!validFirstName || !validLastName)) {
    return { isDuplicate: false, sameJob: false };
  }

  const candidates: any[] = [];
  
  if (validEmail) {
    const { data } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email, job_id, pipeline_stage, created_at, dnh_flag")
      .ilike("email", validEmail)
      .order("created_at", { ascending: false });
    if (data) candidates.push(...data);
  }

  if (validFirstName && validLastName) {
    const { data } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email, job_id, pipeline_stage, created_at, dnh_flag")
      .ilike("first_name", validFirstName)
      .ilike("last_name", validLastName)
      .order("created_at", { ascending: false });
    if (data) candidates.push(...data);
  }

  // Deduplicate results
  const uniqueCandidates = Array.from(new Map(candidates.map(c => [c.id, c])).values())
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (uniqueCandidates.length === 0) {
    return { isDuplicate: false, sameJob: false };
  }

  const sameJobRecord = targetJobId
    ? uniqueCandidates.find((c) => c.job_id === targetJobId)
    : undefined;

  return {
    isDuplicate: true,
    sameJob: !!sameJobRecord,
    existingRecord: sameJobRecord || uniqueCandidates[0],
  };
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
      fit_rating: data.fit_rating,
      pending_resume: data.pending_resume ?? true,
      date_applied: data.date_applied,
      date_sourced: data.date_sourced,
      address: data.address,
      work_experience: data.work_experience ?? [],
    })
    .select("*, jobs(title)")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A candidate with this email already exists.");
    }
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
  newStage: string,
  disqualificationReason?: string,
  recruiterName?: string,
): Promise<StageTransitionResult> {
  const supabase = await createClient();

  if (newStage === HIRED_STAGE) {
    const guardrail = await checkHiredGuardrail(supabase, candidateId);
    if (!guardrail.compliant) {
      return {
        success: false,
        blocked: true,
        missingDocs: guardrail.missingDocs,
        expiredDocs: guardrail.expiredDocs,
      };
    }
  }

  if (newStage === DISQUALIFIED_STAGE) {
    if (!disqualificationReason || !disqualificationReason.trim()) {
      return {
        success: false,
        blocked: false,
        error: "A disqualification reason is required to reject a candidate.",
      };
    }
    if (!DISQUALIFICATION_REASONS.includes(disqualificationReason)) {
      return {
        success: false,
        blocked: false,
        error: `Invalid disqualification reason: "${disqualificationReason}".`,
      };
    }
  }

  const updateData: any = { pipeline_stage: newStage };

  const { error } = await supabase
    .from("candidates")
    .update(updateData)
    .eq("id", candidateId);

  if (error) {
    return {
      success: false,
      blocked: false,
      error: error.message,
    };
  }

  let notes = `Moved to ${newStage}`;
  if (newStage === DISQUALIFIED_STAGE && disqualificationReason) {
    notes = `Disqualified. Reason: ${disqualificationReason}`;
  }

  const { error: logError } = await supabase.from("activity_logs").insert({
    candidate_id: candidateId,
    activity_type:
      newStage === DISQUALIFIED_STAGE ? "Disqualified" : "Stage Change",
    notes,
    author_name: recruiterName || "Recruiter",
  });

  if (logError) {
    return {
      success: false,
      blocked: false,
      error: logError.message,
    };
  }

  revalidatePath("/");

  return { success: true, blocked: false };
}

interface HiredGuardrailResult {
  compliant: boolean;
  missingDocs: string[];
  expiredDocs: string[];
}

async function checkHiredGuardrail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidateId: string,
): Promise<HiredGuardrailResult> {
  const { data, error } = await supabase
    .from("candidate_documents")
    .select("*")
    .eq("candidate_id", candidateId);

  if (error) {
    return {
      compliant: false,
      missingDocs: [error.message],
      expiredDocs: [],
    };
  }

  const documents = (data as CandidateDocument[]) ?? [];
  const now = new Date();
  const missingDocs: string[] = [];
  const expiredDocs: string[] = [];

  for (const doc of documents) {
    const isPending = doc.status === "Pending";
    const isExpired = doc.status === "Expired";

    if (isPending) {
      missingDocs.push(`"${doc.document_name}" is pending`);
    }

    const expiredByDate =
      doc.requires_expiration &&
      !!doc.date_expired &&
      new Date(doc.date_expired) < now;

    if (isExpired || expiredByDate) {
      expiredDocs.push(`"${doc.document_name}" is expired`);
    }
  }

  const compliant = missingDocs.length === 0 && expiredDocs.length === 0;
  return { compliant, missingDocs, expiredDocs };
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

export async function setCandidateDNHStatus(
  candidateId: string,
  dnhData: { dnh_flag: boolean; dnh_reason?: string; dnh_date?: string; dnh_recruiter?: string; }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("candidates")
    .update({
      dnh_flag: dnhData.dnh_flag,
      dnh_reason: dnhData.dnh_reason || null,
      dnh_date: dnhData.dnh_date || null,
      dnh_recruiter: dnhData.dnh_recruiter || null,
    })
    .eq("id", candidateId);

  if (error) {
    return { success: false, error: error.message };
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");

  return { success: true };
}

export async function addCandidateNote(
  candidateId: string,
  noteText: string,
  authorName: string,
  activityType: string = "Note"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("activity_logs").insert({
    candidate_id: candidateId,
    activity_type: activityType,
    notes: noteText,
    author_name: authorName,
    created_at: new Date().toISOString(),
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");

  return { success: true };
}

export async function updateCandidateProfile(
  candidateId: string,
  updateData: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    primary_skills?: string;
    years_of_experience?: number | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("candidates")
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq("id", candidateId);

  if (error) {
    return { success: false, error: error.message };
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");

  return { success: true };
}

export async function updateDuplicateCandidateResume(
  candidateId: string,
  parsedData: ParsedCandidate,
  updatedBy?: string
): Promise<{ success: boolean; error?: string; candidateId?: string }> {
  const supabase = await createClient();

  const { data: candidate, error: fetchError } = await supabase
    .from("candidates")
    .select("id, dnh_flag")
    .eq("id", candidateId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  if (candidate.dnh_flag) {
    return { 
      success: false, 
      error: "Candidate is marked as Do Not Hire (DNH). Resume updates are prohibited." 
    };
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
    pending_resume: false,
  };

  if (parsedData.firstName) updateData.first_name = parsedData.firstName;
  if (parsedData.lastName) updateData.last_name = parsedData.lastName;
  if (parsedData.email) updateData.email = parsedData.email;
  if (parsedData.phone) updateData.phone = parsedData.phone;
  if (parsedData.address) updateData.address = parsedData.address;
  if (parsedData.primarySkills && parsedData.primarySkills.length > 0) {
    updateData.primary_skills = parsedData.primarySkills.join(", ");
  }
  if (parsedData.fitSummary) updateData.ai_summary = parsedData.fitSummary;
  if (typeof parsedData.fitRating === "number") updateData.fit_rating = parsedData.fitRating;
  if (typeof parsedData.yearsOfExperience === "number") updateData.years_of_experience = parsedData.yearsOfExperience;
  if (parsedData.work_experience) updateData.work_experience = parsedData.work_experience;

  const { error: updateError } = await supabase
    .from("candidates")
    .update(updateData)
    .eq("id", candidateId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const { error: logError } = await supabase.from("activity_logs").insert({
    candidate_id: candidateId,
    activity_type: "Resume Updated",
    notes: "Resume updated and re-evaluated via Quick Add",
    author_name: updatedBy || "Recruiter",
    created_at: new Date().toISOString(),
  });

  if (logError) {
    console.error("Failed to log activity:", logError);
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");

  return { success: true, candidateId };
}