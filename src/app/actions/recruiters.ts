"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface Recruiter {
  id: string;
  name: string;
  title: string;
  email: string;
  created_at?: string;
}

export async function getRecruiters(): Promise<Recruiter[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recruiters")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching recruiters:", error);
    return [];
  }

  return (data as Recruiter[]) ?? [];
}

export async function createRecruiter(data: {
  name: string;
  title?: string;
  email: string;
}): Promise<Recruiter> {
  const supabase = await createClient();

  if (!data.name || !data.email) {
    throw new Error("Name and Email are required.");
  }

  if (!data.email.endsWith("@rfcservice.com")) {
    throw new Error("Email must end with @rfcservice.com");
  }

  const { data: insertedData, error } = await supabase
    .from("recruiters")
    .insert({
      name: data.name,
      title: data.title || "Recruiter",
      email: data.email,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  return insertedData as Recruiter;
}
