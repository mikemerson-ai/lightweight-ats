"use server";

import { createClient } from "@/lib/supabase/server";

export type JobStatus = "Active" | "Closed";

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  status: JobStatus;
  created_at: string;
}

export interface CreateJobInput {
  title: string;
  department: string;
  location: string;
  description: string;
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

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      title: formData.get("title"),
      department: formData.get("department"),
      location: formData.get("location"),
      description: formData.get("description"),
      status: "Active",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Job;
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

  return data as Job;
}