"use server";

import { createClient } from "@/lib/supabase/server";

import { revalidatePath } from "next/cache";

export type JobStatus = "Active" | "Closed";

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  requirements: string;
  target_headcount: number;
  status: JobStatus;
  created_at: string;
}

export interface CreateJobInput {
  title: string;
  department: string;
  location: string;
  description: string;
  requirements: string;
  target_headcount: number;
}

export async function getJobs(): Promise<Job[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as Job[]) ?? [];
}

export async function createJob(formData: FormData): Promise<Job> {
  const supabase = await createClient();

  const title = formData.get("title") as string;
  const department = formData.get("department") as string;
  const location = formData.get("location") as string;
  const description = formData.get("description") as string;
  const requirements = formData.get("requirements") as string;
  const target_headcount_str = formData.get("target_headcount") as string;

  if (!title || !department || !description || !requirements) {
    throw new Error("Missing required fields: Title, Department, Description, and Requirements are mandatory.");
  }

  // Duplicate detection for createJob
  const { data: existingJob, error: checkError } = await supabase
    .from("jobs")
    .select("id")
    .ilike("title", title)
    .limit(1);

  if (existingJob && existingJob.length > 0) {
    throw new Error("A job opening with this title already exists.");
  }

  const target_headcount = target_headcount_str ? parseInt(target_headcount_str, 10) : 1;

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      title,
      department,
      location: location || "",
      description,
      requirements,
      target_headcount,
      status: "Active",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Job;
}

export async function updateJob(jobId: string, data: { title: string; department: string; target_headcount: number; description: string; requirements: string }): Promise<Job> {
  const supabase = await createClient();

  const { data: existingJob, error: checkError } = await supabase
    .from("jobs")
    .select("id")
    .ilike("title", data.title)
    .neq("id", jobId)
    .limit(1);

  if (existingJob && existingJob.length > 0) {
    throw new Error("A job opening with this title already exists.");
  }

  const { data: updatedData, error } = await supabase
    .from("jobs")
    .update(data)
    .eq("id", jobId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  return updatedData as Job;
}

export async function deleteJob(jobId: string, forceCascade: boolean = false): Promise<void> {
  const supabase = await createClient();

  // Check if active candidates are assigned to the job.
  const { data: candidates, error: candidateError } = await supabase
    .from("candidates")
    .select("id")
    .eq("job_id", jobId)
    .limit(1);

  if (candidateError) {
    throw new Error(candidateError.message);
  }

  const hasCandidates = candidates && candidates.length > 0;

  if (hasCandidates && !forceCascade) {
    throw new Error("Cannot_Delete_Has_Candidates");
  }

  // If forceCascade is true, we must delete the associated candidates first manually if cascade constraints aren't set in the DB
  if (hasCandidates && forceCascade) {
    // Delete candidates manually to cascade
    const { data: allCandidates } = await supabase
      .from("candidates")
      .select("id")
      .eq("job_id", jobId);

    if (allCandidates && allCandidates.length > 0) {
      for (const candidate of allCandidates) {
        await supabase.from("activity_logs").delete().eq("candidate_id", candidate.id);
        await supabase.from("document_checklists").delete().eq("candidate_id", candidate.id);
        await supabase.from("evaluations").delete().eq("candidate_id", candidate.id);
        await supabase.from("candidates").delete().eq("id", candidate.id);
      }
    }
  }

  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function toggleJobStatus(
  jobId: string,
  currentStatus: JobStatus,
): Promise<Job> {
  const supabase = await createClient();

  const nextStatus: JobStatus = currentStatus === "Active" ? "Closed" : "Active";

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: nextStatus })
    .eq("id", jobId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  return data as Job;
}

export async function getJobById(jobId: string): Promise<Job | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(error.message);
  }

  return data as Job;
}