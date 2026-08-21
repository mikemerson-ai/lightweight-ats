"use server";

import { createClient } from "@/lib/supabase/server";

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