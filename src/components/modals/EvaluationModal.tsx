"use client";

import { useState, useEffect } from "react";
import { X, Star } from "lucide-react";
import {
  type Candidate,
} from "@/app/actions/candidates";
import { submitEvaluation, getScorecardTemplate } from "@/app/actions/evaluations";
import {
  EVALUATION_RECOMMENDATIONS,
  type EvaluationRecommendation,
  type ScorecardCriterion,
} from "@/types/evaluations";
import { useRecruiter } from "@/context/RecruiterContext";

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

  const [criteria, setCriteria] = useState<ScorecardCriterion[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<EvaluationRecommendation>(
    "Hire",
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && candidate?.job_id) {
      loadTemplate(candidate.job_id);
    }
  }, [open, candidate]);

  async function loadTemplate(jobId: string) {
    setLoading(true);
    setError("");
    try {
      const template = await getScorecardTemplate(jobId);
      setCriteria(template.criteria);
      
      const initialScores: Record<string, number> = {};
      template.criteria.forEach(c => {
        initialScores[c.id] = 0;
      });
      setScores(initialScores);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load evaluation criteria.");
    } finally {
      setLoading(false);
    }
  }

  if (!open || !candidate) {
    return null;
  }

  const currentCandidate = candidate;

  function reset() {
    const initialScores: Record<string, number> = {};
    criteria.forEach(c => {
      initialScores[c.id] = 0;
    });
    setScores(initialScores);
    setRecommendation("Hire");
    setNotes("");
    setError("");
  }

  async function handleSubmit() {
    const hasAllScores = criteria.every(
      (c) => (scores[c.id] ?? 0) > 0,
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
      <div className="relative w-full max-w-lg rounded-xl border bg-white shadow-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between bg-primary px-5 py-4 shrink-0">
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

        <div className="flex flex-col gap-5 bg-slate-50 p-6 flex-1">
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

          {loading ? (
            <div className="py-8 text-center text-slate-500">Loading criteria...</div>
          ) : (
            <div className="grid gap-4">
              {criteria.map((c) => {
                const current = scores[c.id] ?? 0;
                return (
                  <div key={c.id} className="grid gap-1.5">
                    <span className="text-sm font-medium text-primary">{c.name}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-label={`${c.name}: ${value} out of 5`}
                          className={`flex items-center justify-center rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                            current === value
                              ? "border-primary bg-primary text-white"
                              : "border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
                          }`}
                          onClick={() =>
                            setScores((prev) => ({ ...prev, [c.id]: value }))
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
          )}

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
              disabled={saving || loading}
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