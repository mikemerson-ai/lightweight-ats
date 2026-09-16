"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import type { Recruiter } from "@/types/recruiters";
import { DEFAULT_RECRUITERS } from "@/types/recruiters";
export type { Recruiter };

export async function getRecruiters(): Promise<Recruiter[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("recruiters")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("Failed to fetch recruiters from database, using fallback:", error.message);
      return DEFAULT_RECRUITERS;
    }

    if (!data || data.length === 0) {
      return DEFAULT_RECRUITERS;
    }

    return data as Recruiter[];
  } catch (err) {
    console.warn("Error fetching recruiters, using fallback:", err);
    return DEFAULT_RECRUITERS;
  }
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
