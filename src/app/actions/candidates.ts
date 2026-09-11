"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CandidateDocument } from "@/types/documents";
import { parseResumeData, type ParsedCandidate } from "@/lib/gemini/parser";

import { SourcingChannel } from "@/lib/constants";
import type { Evaluation } from "@/types/evaluations";

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
  resume_text?: string | null;
  resume_url?: string | null;
  resume_storage_path?: string | null;
  sub_scores?: { functionalExperience?: number; requiredCredentials?: number; roleSpecificSkills?: number } | null;
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
  resume_text?: string | null;
  resume_url?: string | null;
  resume_storage_path?: string | null;
  sub_scores?: { functionalExperience?: number; requiredCredentials?: number; roleSpecificSkills?: number } | null;
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
  evaluations?: Evaluation[];
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
    .select("*, jobs(title), evaluations(id, candidate_id, reviewer_name, recommendation, aggregate_score, notes, created_at)")
    .or(
      `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,primary_skills.ilike.%${trimmed}%,status_tag.ilike.%${trimmed}%`,
    )
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data as Candidate[]) ?? [];
}

export interface ExistingCandidateRecord {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  job_id: string;
  job_title?: string;
  pipeline_stage: string;
  created_at: string;
  dnh_flag?: boolean;
}

export interface CandidateDuplicateResult {
  isDuplicate: boolean;
  sameJob: boolean;
  isBatchInternalDuplicate?: boolean;
  existingRecord?: ExistingCandidateRecord;
}

export interface BatchDuplicateCheckItem {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export async function checkCandidateDuplicate(
  firstName: string,
  lastName: string,
  email?: string,
  targetJobId?: string
): Promise<{
  isDuplicate: boolean;
  sameJob: boolean;
  existingRecord?: Partial<Candidate> & { jobs?: { title?: string } };
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
      .select("id, first_name, last_name, email, job_id, pipeline_stage, created_at, dnh_flag, jobs(title)")
      .ilike("email", validEmail)
      .order("created_at", { ascending: false });
    if (data) candidates.push(...data);
  }

  if (validFirstName && validLastName) {
    const { data } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email, job_id, pipeline_stage, created_at, dnh_flag, jobs(title)")
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

export async function checkBatchCandidateDuplicates(
  items: BatchDuplicateCheckItem[],
  targetJobId: string
): Promise<Record<string, CandidateDuplicateResult>> {
  const supabase = await createClient();
  const results: Record<string, CandidateDuplicateResult> = {};

  if (!items || items.length === 0) {
    return results;
  }

  // 1. Identify batch-internal duplicates
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  const batchDuplicates = new Set<string>();

  for (const item of items) {
    const isInvalidEmail = !item.email || !item.email.trim() || ["not provided", "not available", "n/a"].includes(item.email.trim().toLowerCase());
    const validEmail = isInvalidEmail ? null : item.email?.trim().toLowerCase();
    const nameKey = `${item.firstName?.trim().toLowerCase() || ""}_${item.lastName?.trim().toLowerCase() || ""}`;
    const hasValidName = !!(item.firstName?.trim() && item.lastName?.trim());

    let isInternalDup = false;
    if (validEmail && seenEmails.has(validEmail)) {
      isInternalDup = true;
    }
    if (hasValidName && seenNames.has(nameKey)) {
      isInternalDup = true;
    }

    if (isInternalDup) {
      batchDuplicates.add(item.id);
    } else {
      if (validEmail) seenEmails.add(validEmail);
      if (hasValidName) seenNames.add(nameKey);
    }
  }

  // 2. Query database for existing candidates matching emails or names
  const validEmails = Array.from(seenEmails);
  const matchedDbCandidates: any[] = [];

  if (validEmails.length > 0) {
    const { data: emailMatches } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email, job_id, pipeline_stage, created_at, dnh_flag, jobs(title)")
      .in("email", validEmails);
    if (emailMatches) matchedDbCandidates.push(...emailMatches);
  }

  // Query for name matches
  for (const item of items) {
    const validFirst = item.firstName?.trim();
    const validLast = item.lastName?.trim();
    if (validFirst && validLast) {
      const { data: nameMatches } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, email, job_id, pipeline_stage, created_at, dnh_flag, jobs(title)")
        .ilike("first_name", validFirst)
        .ilike("last_name", validLast);
      if (nameMatches) matchedDbCandidates.push(...nameMatches);
    }
  }

  // Deduplicate matched records by ID
  const dbCandidatesMap = new Map<string, any>();
  matchedDbCandidates.forEach((c) => {
    dbCandidatesMap.set(c.id, c);
  });
  const allDbCandidates = Array.from(dbCandidatesMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // 3. Match each item in batch against DB candidates
  for (const item of items) {
    const isInvalidEmail = !item.email || !item.email.trim() || ["not provided", "not available", "n/a"].includes(item.email.trim().toLowerCase());
    const validEmail = isInvalidEmail ? null : item.email?.trim().toLowerCase();
    const validFirst = item.firstName?.trim().toLowerCase();
    const validLast = item.lastName?.trim().toLowerCase();
    const isInternal = batchDuplicates.has(item.id);

    const matches = allDbCandidates.filter((c) => {
      if (validEmail && c.email && c.email.trim().toLowerCase() === validEmail) {
        return true;
      }
      if (
        validFirst &&
        validLast &&
        c.first_name?.trim().toLowerCase() === validFirst &&
        c.last_name?.trim().toLowerCase() === validLast
      ) {
        return true;
      }
      return false;
    });

    if (matches.length > 0) {
      const sameJobMatch = targetJobId
        ? matches.find((m) => m.job_id === targetJobId)
        : undefined;
      const targetRecord = sameJobMatch || matches[0];

      results[item.id] = {
        isDuplicate: true,
        sameJob: !!sameJobMatch,
        isBatchInternalDuplicate: isInternal,
        existingRecord: {
          id: targetRecord.id,
          first_name: targetRecord.first_name,
          last_name: targetRecord.last_name,
          email: targetRecord.email,
          job_id: targetRecord.job_id,
          job_title: targetRecord.jobs?.title || undefined,
          pipeline_stage: targetRecord.pipeline_stage,
          created_at: targetRecord.created_at,
          dnh_flag: targetRecord.dnh_flag,
        },
      };
    } else if (isInternal) {
      results[item.id] = {
        isDuplicate: false,
        sameJob: false,
        isBatchInternalDuplicate: true,
      };
    } else {
      results[item.id] = {
        isDuplicate: false,
        sameJob: false,
        isBatchInternalDuplicate: false,
      };
    }
  }

  return results;
}

export async function quickAddSourcedCandidate(
  data: QuickAddSourcedCandidateInput,
): Promise<{ success: boolean; candidate?: Candidate; error?: string }> {
  const supabase = await createClient();

  const insertPayload: any = {
    first_name: data.first_name,
    last_name: data.last_name,
    pipeline_stage: "new_application",
    source_channel: data.source_channel,
    source_type: data.source_type || "outbound",
    job_id: data.job_id,
    contact_info: data.contact_info,
    linkedin_url: data.linkedin_url,
    email: (!data.email || ["not provided", "not available", "n/a"].includes(data.email.trim().toLowerCase())) ? null : data.email.trim(),
    phone: (!data.phone || ["not provided", "not available", "n/a"].includes(data.phone.trim().toLowerCase())) ? null : data.phone.trim(),
    primary_skills: data.primary_skills,
    years_of_experience: data.years_of_experience,
    ai_summary: data.ai_summary,
    fit_rating: data.fit_rating,
    pending_resume: data.pending_resume ?? true,
    date_applied: data.date_applied,
    date_sourced: data.date_sourced,
    address: data.address,
    work_experience: data.work_experience ?? [],
  };

  if (data.resume_text) {
    insertPayload.resume_text = data.resume_text;
  }
  if (data.sub_scores) {
    insertPayload.sub_scores = data.sub_scores;
  }
  if (data.resume_url) {
    insertPayload.resume_url = data.resume_url;
  }
  if (data.resume_storage_path) {
    insertPayload.resume_storage_path = data.resume_storage_path;
  }

  let { data: candidate, error } = await supabase
    .from("candidates")
    .insert(insertPayload)
    .select("*, jobs(title)")
    .single();

  // If column doesn't exist yet in the database schema, gracefully retry without new columns
  if (error && (error.message?.includes("resume_text") || error.message?.includes("sub_scores") || error.message?.includes("resume_url") || error.message?.includes("resume_storage_path"))) {
    delete insertPayload.resume_text;
    delete insertPayload.sub_scores;
    delete insertPayload.resume_url;
    delete insertPayload.resume_storage_path;
    const retry = await supabase
      .from("candidates")
      .insert(insertPayload)
      .select("*, jobs(title)")
      .single();
    candidate = retry.data;
    error = retry.error;
  }

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "A candidate with this email already exists." };
    }
    return { success: false, error: error.message };
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
    return { success: false, error: createLogError.message };
  }

  if (data.outreach_notes) {
    const { error: logError } = await supabase.from("activity_logs").insert({
      candidate_id: candidate.id,
      activity_type: "outreach_note",
      notes: data.outreach_notes,
      author_name: data.author_name || "Recruiter",
    });

    if (logError) {
      return { success: false, error: logError.message };
    }
  }

  revalidatePath("/");

  return { success: true, candidate: candidate as Candidate };
}

export async function getCandidatesByJob(jobId: string): Promise<Candidate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("candidates")
    .select("*, jobs(title), evaluations(id, candidate_id, reviewer_name, recommendation, aggregate_score, notes, created_at)")
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

export interface UploadResumeResult {
  success: boolean;
  resume_url?: string;
  resume_storage_path?: string;
  candidate?: Candidate;
  error?: string;
}

export async function uploadCandidateResume(
  candidateId: string,
  formData: FormData
): Promise<UploadResumeResult> {
  const supabase = await createClient();
  const file = formData.get("file") as File | null;
  const authorName = (formData.get("authorName") as string) || "Recruiter";

  if (!file || !(file instanceof File) || file.size === 0) {
    return { success: false, error: "No resume file provided or file is empty." };
  }

  try {
    // 1. Check if candidate already has an existing resume file and delete it from storage
    const { data: candidate } = await supabase
      .from("candidates")
      .select("id, resume_storage_path")
      .eq("id", candidateId)
      .single();

    if (candidate?.resume_storage_path) {
      try {
        await supabase.storage.from("resumes").remove([candidate.resume_storage_path]);
      } catch (e) {
        console.warn("Could not remove previous resume from storage:", e);
      }
    }

    // 2. Upload file to Supabase storage
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${candidateId}/${Date.now()}_${cleanFileName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(filePath, fileBuffer, {
        contentType: file.type || "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Storage upload failed: ${uploadError.message}` };
    }

    // 3. Get public URL
    const { data: { publicUrl } } = supabase.storage.from("resumes").getPublicUrl(filePath);

    // 4. Update candidate record in DB
    const updatePayload: Record<string, any> = {
      resume_url: publicUrl,
      resume_storage_path: filePath,
      pending_resume: false,
      updated_at: new Date().toISOString(),
    };

    let { data: updatedCandidate, error: updateError } = await supabase
      .from("candidates")
      .update(updatePayload)
      .eq("id", candidateId)
      .select("*, jobs(title)")
      .single();

    if (updateError && (updateError.message?.includes("resume_url") || updateError.message?.includes("resume_storage_path"))) {
      // Graceful retry without the columns if user hasn't run the migration yet
      const fallbackRetry = await supabase
        .from("candidates")
        .update({
          pending_resume: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidateId)
        .select("*, jobs(title)")
        .single();
      updatedCandidate = fallbackRetry.data;
      updateError = fallbackRetry.error;
    }

    if (updateError) {
      return { success: false, error: `Failed to update candidate: ${updateError.message}` };
    }

    // 5. Activity log
    await supabase.from("activity_logs").insert({
      candidate_id: candidateId,
      activity_type: "Resume Uploaded",
      notes: `Uploaded resume: ${file.name}`,
      author_name: authorName,
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/");

    return {
      success: true,
      resume_url: publicUrl,
      resume_storage_path: filePath,
      candidate: updatedCandidate as Candidate,
    };
  } catch (err: any) {
    console.error("Error in uploadCandidateResume:", err);
    return { success: false, error: err.message || "Failed to upload resume" };
  }
}

export async function deleteCandidateResume(candidateId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: candidate } = await supabase
    .from("candidates")
    .select("resume_storage_path")
    .eq("id", candidateId)
    .single();

  if (candidate?.resume_storage_path) {
    try {
      await supabase.storage.from("resumes").remove([candidate.resume_storage_path]);
    } catch (e) {
      console.warn("Failed to remove resume from storage:", e);
    }
  }

  const { error } = await supabase
    .from("candidates")
    .update({
      resume_url: null,
      resume_storage_path: null,
      pending_resume: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId);

  if (error) {
    return { success: false, error: error.message };
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");
  return { success: true };
}

export async function deleteCandidate(candidateId: string): Promise<void> {
  const supabase = await createClient();

  // 1. Fetch candidate to check for stored resume file
  const { data: candidate } = await supabase
    .from("candidates")
    .select("resume_storage_path")
    .eq("id", candidateId)
    .single();

  // 2. Clean up stored resume file from Supabase Storage
  if (candidate?.resume_storage_path) {
    try {
      await supabase.storage.from("resumes").remove([candidate.resume_storage_path]);
    } catch (storageErr) {
      console.error("Failed to delete resume file from storage:", storageErr);
    }
  }

  // Also clean up any lingering files in the candidate's storage folder
  try {
    const { data: files } = await supabase.storage.from("resumes").list(candidateId);
    if (files && files.length > 0) {
      const pathsToDelete = files.map((f) => `${candidateId}/${f.name}`);
      await supabase.storage.from("resumes").remove(pathsToDelete);
    }
  } catch (err) {
    console.warn("Could not list/clean storage folder for candidate:", err);
  }

  // 3. Delete associated records manually to ensure they are removed if cascading deletes aren't configured
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
    email?: string | null;
    phone?: string | null;
    address?: string;
    primary_skills?: string;
    years_of_experience?: number | null;
    date_applied?: string;
    date_sourced?: string;
    linkedin_url?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const cleanData = { ...updateData };
  if (cleanData.linkedin_url) {
    cleanData.linkedin_url = cleanData.linkedin_url.trim();
  }
  if (cleanData.email) {
    cleanData.email = ["not provided", "not available", "n/a"].includes(cleanData.email.trim().toLowerCase()) ? null : cleanData.email.trim();
  }
  if (cleanData.phone) {
    cleanData.phone = ["not provided", "not available", "n/a"].includes(cleanData.phone.trim().toLowerCase()) ? null : cleanData.phone.trim();
  }

  const { error } = await supabase
    .from("candidates")
    .update({ ...cleanData, updated_at: new Date().toISOString() })
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
): Promise<{ success: boolean; error?: string; candidate?: Candidate }> {
  const supabase = await createClient();

  const { data: candidateRecord, error: fetchError } = await supabase
    .from("candidates")
    .select("id, dnh_flag")
    .eq("id", candidateId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  if (candidateRecord.dnh_flag) {
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
  if (parsedData.email) {
    updateData.email = ["not provided", "not available", "n/a"].includes(parsedData.email.trim().toLowerCase()) ? null : parsedData.email.trim();
  }
  if (parsedData.phone) {
    updateData.phone = ["not provided", "not available", "n/a"].includes(parsedData.phone.trim().toLowerCase()) ? null : parsedData.phone.trim();
  }
  if (parsedData.address) updateData.address = parsedData.address;
  if (parsedData.primarySkills && parsedData.primarySkills.length > 0) {
    updateData.primary_skills = parsedData.primarySkills.join(", ");
  }
  if (parsedData.fitSummary) updateData.ai_summary = parsedData.fitSummary;
  if (typeof parsedData.fitRating === "number") updateData.fit_rating = parsedData.fitRating;
  if (typeof parsedData.yearsOfExperience === "number") updateData.years_of_experience = parsedData.yearsOfExperience;
  if (parsedData.work_experience) updateData.work_experience = parsedData.work_experience;
  if (parsedData.rawResumeText) updateData.resume_text = parsedData.rawResumeText;
  if (parsedData.subScores) updateData.sub_scores = parsedData.subScores;

  let { data: updatedCandidate, error: updateError } = await supabase
    .from("candidates")
    .update(updateData)
    .eq("id", candidateId)
    .select("*, jobs(title)")
    .single();

  if (updateError && (updateError.message?.includes("resume_text") || updateError.message?.includes("sub_scores"))) {
    delete updateData.resume_text;
    delete updateData.sub_scores;
    const retry = await supabase
      .from("candidates")
      .update(updateData)
      .eq("id", candidateId)
      .select("*, jobs(title)")
      .single();
    updatedCandidate = retry.data;
    updateError = retry.error;
  }

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

  return { success: true, candidate: updatedCandidate as Candidate };
}

export async function reEvaluateCandidateFit(
  candidateId: string,
  updatedBy?: string
): Promise<{ success: boolean; candidate?: Candidate; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Fetch candidate with job details
    const { data: candidate, error: fetchError } = await supabase
      .from("candidates")
      .select("*, jobs(id, title, description, requirements)")
      .eq("id", candidateId)
      .single();

    if (fetchError || !candidate) {
      return { success: false, error: fetchError?.message || "Candidate not found" };
    }

    const job = candidate.jobs as { id: string; title: string; description: string; requirements?: string } | null;
    if (!job || !job.description || job.description.trim().length === 0) {
      return {
        success: false,
        error: "Target job description is missing. A valid job description is required for re-evaluation.",
      };
    }

    // 2. Determine payload: prefer resume_text, then fall back to synthesized profile text
    let payload: string;
    if (candidate.resume_text && candidate.resume_text.trim().length > 30) {
      payload = candidate.resume_text;
    } else {
      let profileText = `Candidate Name: ${candidate.first_name} ${candidate.last_name}\n`;
      if (candidate.primary_skills) profileText += `Key Skills: ${candidate.primary_skills}\n`;
      if (candidate.years_of_experience) profileText += `Years of Experience: ${candidate.years_of_experience}\n`;
      if (candidate.ai_summary) profileText += `Previous Summary: ${candidate.ai_summary}\n`;
      if (candidate.work_experience && Array.isArray(candidate.work_experience) && candidate.work_experience.length > 0) {
        profileText += `\nWork Experience:\n`;
        candidate.work_experience.forEach((exp: any) => {
          profileText += `- ${exp.jobTitle || 'Role'} at ${exp.company || 'Company'} (${exp.dates || ''}): ${exp.summary || ''}\n`;
        });
      }
      payload = profileText;
    }

    // 3. Re-run Gemini Pass 1
    const parsedData = await parseResumeData(payload, {
      title: job.title,
      description: job.description,
      requirements: job.requirements || "",
    });

    // 4. Update candidate record
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
      ai_summary: parsedData.fitSummary,
      fit_rating: parsedData.fitRating,
    };
    if (parsedData.primarySkills?.length) {
      updatePayload.primary_skills = parsedData.primarySkills.join(", ");
    }
    if (typeof parsedData.yearsOfExperience === "number") {
      updatePayload.years_of_experience = parsedData.yearsOfExperience;
    }
    if (parsedData.work_experience?.length) {
      updatePayload.work_experience = parsedData.work_experience;
    }
    if (parsedData.rawResumeText) {
      updatePayload.resume_text = parsedData.rawResumeText;
    }
    if (parsedData.subScores) {
      updatePayload.sub_scores = parsedData.subScores;
    }

    let { data: updatedCandidate, error: updateError } = await supabase
      .from("candidates")
      .update(updatePayload)
      .eq("id", candidateId)
      .select("*, jobs(title)")
      .single();

    if (updateError && (updateError.message?.includes("resume_text") || updateError.message?.includes("sub_scores"))) {
      delete updatePayload.resume_text;
      delete updatePayload.sub_scores;
      const retry = await supabase
        .from("candidates")
        .update(updatePayload)
        .eq("id", candidateId)
        .select("*, jobs(title)")
        .single();
      updatedCandidate = retry.data;
      updateError = retry.error;
    }

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // 5. Activity log
    await supabase.from("activity_logs").insert({
      candidate_id: candidateId,
      activity_type: "AI Fit Re-evaluated",
      notes: `Candidate fit re-evaluated against ${job.title}: ${parsedData.fitRating}/5 stars`,
      author_name: updatedBy || "Recruiter",
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/");

    return { success: true, candidate: updatedCandidate as Candidate };
  } catch (err: any) {
    console.error("Error re-evaluating candidate:", err);
    return { success: false, error: err.message || "An unexpected error occurred during re-evaluation." };
  }
}

export interface BatchImportCandidateInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  primary_skills?: string;
  years_of_experience?: number | null;
  ai_summary?: string | null;
  fit_rating?: number | null;
  sub_scores?: { functionalExperience?: number; requiredCredentials?: number; roleSpecificSkills?: number } | null;
  resume_text?: string | null;
  work_experience?: Array<{ jobTitle: string; company: string; dates: string; summary: string }>;
  job_id: string;
  source_channel?: string;
  source_type?: string;
  date_applied?: string;
  date_sourced?: string;
  author_name?: string;
}

export async function bulkAddCandidates(
  candidatesData: BatchImportCandidateInput[]
): Promise<{ success: boolean; count: number; importedCandidates?: Candidate[]; errors?: string[] }> {
  try {
    const supabase = await createClient();
    const imported: Candidate[] = [];
    const errors: string[] = [];

    for (const data of candidatesData) {
      const emailVal = (!data.email || ["not provided", "not available", "n/a"].includes(data.email.trim().toLowerCase())) ? null : data.email.trim();
      const phoneVal = (!data.phone || ["not provided", "not available", "n/a"].includes(data.phone.trim().toLowerCase())) ? null : data.phone.trim();
      const today = new Date().toISOString().split("T")[0];
      const isSourced = data.source_type === "outbound" || data.source_type === "sourced";

      const insertPayload: any = {
        first_name: data.first_name || "Candidate",
        last_name: data.last_name || "Unknown",
        pipeline_stage: "new_application",
        source_channel: data.source_channel || "Batch Upload",
        source_type: data.source_type || (isSourced ? "outbound" : "inbound"),
        job_id: data.job_id,
        contact_info: emailVal || phoneVal || "Batch Imported",
        email: emailVal,
        phone: phoneVal,
        address: data.address,
        primary_skills: data.primary_skills,
        years_of_experience: data.years_of_experience,
        ai_summary: data.ai_summary,
        fit_rating: data.fit_rating,
        pending_resume: false,
        date_applied: data.date_applied || today,
        date_sourced: isSourced ? (data.date_sourced || today) : undefined,
        work_experience: data.work_experience ?? [],
      };

      if (data.resume_text) insertPayload.resume_text = data.resume_text;
      if (data.sub_scores) insertPayload.sub_scores = data.sub_scores;

      let { data: candidate, error } = await supabase
        .from("candidates")
        .insert(insertPayload)
        .select("*, jobs(title)")
        .single();

      if (error && (error.message?.includes("resume_text") || error.message?.includes("sub_scores"))) {
        delete insertPayload.resume_text;
        delete insertPayload.sub_scores;
        const retry = await supabase
          .from("candidates")
          .insert(insertPayload)
          .select("*, jobs(title)")
          .single();
        candidate = retry.data;
        error = retry.error;
      }

      if (error) {
        errors.push(`Failed to import ${data.first_name} ${data.last_name}: ${error.message}`);
        continue;
      }

      if (candidate) {
        imported.push(candidate as Candidate);
        await supabase.from("activity_logs").insert({
          candidate_id: candidate.id,
          activity_type: "Batch Ingested",
          notes: `Candidate imported via AI Batch Intake: ${data.fit_rating ?? 0}/5 fit rating`,
          author_name: data.author_name || "Recruiter",
        });
      }
    }

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/");

    return {
      success: imported.length > 0,
      count: imported.length,
      importedCandidates: imported,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err: any) {
    console.error("Error during batch candidate creation:", err);
    return { success: false, count: 0, errors: [err.message || "Unexpected batch error"] };
  }
}