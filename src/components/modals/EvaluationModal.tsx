"use client";

import { useState } from "react";
import { X, Star } from "lucide-react";
import {
  type Candidate,
} from "@/app/actions/candidates";
import { submitEvaluation } from "@/app/actions/evaluations";
import {
  EVALUATION_RECOMMENDATIONS,
  type EvaluationRecommendation,
} from "@/types/evaluations";
import { useRecruiter } from "@/context/RecruiterContext";

const CRITERIA = [
  { key: "technical_role_fit", label: "Technical / Role Fit" },
  { key: "communication", label: "Communication" },
  { key: "reliability", label: "Reliability" },
  { key: "culture_fit", label: "Culture Fit" },
] as const;

type CriterionKey = (typeof CRITERIA)[number]["key"];

const RECOMMENDATION_STYLES: Record<
  EvaluationRecommendation,
  { base: string; selected: string }
> = {
  "Strong Hire": { base: "bg-white", selected: "bg-success text-white" },
  Hire: { base: "bg-white", selected: "bg-secondary text-white" },
  Hold: { base: "bg-white", selected: "bg-warning text-white" },
  Reject: { base: "bg-white", selected: "bg-danger text-white" },
};

interface EvaluationModalProps {
  candidate: Candidate | null;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function EvaluationModal({
  candidate,
  open,
  onClose,
  onSubmitted,
}: EvaluationModalProps) {
  const { activeRecruiter } = useRecruiter();

  const [scores, setScores] = useState<Record<CriterionKey, number>>({
    technical_role_fit: 0,
    communication: 0,
    reliability: 0,
    culture_fit: 0,
  });
  const [recommendation, setRecommendation] = useState<EvaluationRecommendation>(
    "Hire",
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open || !candidate) {
    return null;
  }

  const currentCandidate = candidate;

  function reset() {
    setScores({
      technical_role_fit: 0,
      communication: 0,
      reliability: 0,
      culture_fit: 0,
    });
    setRecommendation("Hire");
    setNotes("");
    setError("");
  }

  async function handleSubmit() {
    const hasAllScores = CRITERIA.every(
      ({ key }) => (scores[key] ?? 0) > 0,
    );
    if (!hasAllScores) {
      setError("Please rate every competency before submitting.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await submitEvaluation({
        candidate_id: currentCandidate.id,
        reviewer_name: activeRecruiter?.name || "Recruiter",
        recommendation,
        scores,
        notes,
      });
      reset();
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border bg-white shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between bg-primary px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Submit Evaluation</h2>
          <button
            type="button"
            aria-label="Close"
            className="text-white hover:text-white/70"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 bg-slate-50 p-6">
          <div>
            <p className="text-sm text-slate-500">
              Reviewing
              <span className="font-medium text-slate-900">
                {" "}
                {candidate.first_name} {candidate.last_name}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Reviewer:{" "}
              <span className="font-medium text-primary">
                {activeRecruiter?.name || "Recruiter"}
              </span>
            </p>
          </div>

          <div className="grid gap-4">
            {CRITERIA.map(({ key, label }) => {
              const current = scores[key] ?? 0;
              return (
                <div key={key} className="grid gap-1.5">
                  <span className="text-sm font-medium text-primary">{label}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={`${label}: ${value} out of 5`}
                        className={`flex items-center justify-center rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                          current === value
                            ? "border-primary bg-primary text-white"
                            : "border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
                        }`}
                        onClick={() =>
                          setScores((prev) => ({ ...prev, [key]: value }))
                        }
                      >
                        <Star
                          className={`mr-1 h-4 w-4 ${
                            current === value ? "text-white" : "text-warning"
                          }`}
                        />
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-primary">Recommendation</span>
            <div className="flex flex-wrap gap-2">
              {EVALUATION_RECOMMENDATIONS.map((rec) => {
                const isSelected = recommendation === rec;
                const { base, selected } = RECOMMENDATION_STYLES[rec];
                return (
                  <button
                    key={rec}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? `${selected} border-transparent`
                        : `${base} border-slate-300 text-slate-600 hover:bg-slate-100`
                    }`}
                    onClick={() => setRecommendation(rec)}
                  >
                    {rec}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              Detailed Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add interview notes, commentary, and reasoning for your recommendation..."
              className={`${inputClass} resize-none`}
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Submitting..." : "Submit Evaluation"}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}