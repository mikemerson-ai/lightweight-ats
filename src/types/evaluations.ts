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

export interface ScorecardCriterion {
  id: string;
  name: string;
  description?: string;
  weight?: number;
}

export interface ScorecardTemplate {
  id: string;
  job_id: string;
  template_name: string;
  criteria: ScorecardCriterion[];
  created_at?: string;
}