"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Evaluation, SubmitEvaluationInput } from "@/types/evaluations";

function computeAggregate(scores: Record<string, number>): number {
  const values = Object.values(scores).filter(
    (value) => typeof value === "number" && value > 0,
  );
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

export async function getEvaluationsByCandidate(
  candidateId: string,
): Promise<Evaluation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as Evaluation[]) ?? [];
}

export async function submitEvaluation(
  input: SubmitEvaluationInput,
): Promise<Evaluation> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      candidate_id: input.candidate_id,
      reviewer_name: input.reviewer_name || "Recruiter",
      recommendation: input.recommendation,
      scores: input.scores,
      aggregate_score: computeAggregate(input.scores),
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  return data as Evaluation;
}