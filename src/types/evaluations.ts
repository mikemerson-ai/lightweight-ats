export const EVALUATION_RECOMMENDATIONS = [
  "Strong Hire",
  "Hire",
  "Hold",
  "Reject",
] as const;

export type EvaluationRecommendation = (typeof EVALUATION_RECOMMENDATIONS)[number];

export interface Evaluation {
  id: string;
  candidate_id: string;
  reviewer_name: string;
  recommendation: string;
  scores: Record<string, number>;
  aggregate_score: number;
  notes: string | null;
  created_at: string;
}

export interface SubmitEvaluationInput {
  candidate_id: string;
  reviewer_name: string;
  recommendation: string;
  scores: Record<string, number>;
  notes?: string;
}