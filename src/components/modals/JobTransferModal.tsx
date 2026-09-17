"use client";

import React, { useState, useEffect } from "react";
import { X, Briefcase, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import type { Candidate } from "@/app/actions/candidates";
import type { Job } from "@/app/actions/jobs";
import { transferCandidateJob } from "@/app/actions/candidates";
import { createClient } from "@/lib/supabase/client";
import { useRecruiter } from "@/context/RecruiterContext";
import { PIPELINE_STAGES } from "@/components/kanban/KanbanBoard";

interface JobTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate;
  availableJobs?: Job[];
  onTransferComplete: (updatedCandidate: Candidate) => void;
}

export default function JobTransferModal({
  isOpen,
  onClose,
  candidate,
  availableJobs,
  onTransferComplete,
}: JobTransferModalProps) {
  const { activeRecruiter } = useRecruiter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingJobs, setFetchingJobs] = useState(false);
  
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedStage, setSelectedStage] = useState("new_application");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSelectedJobId("");
      setSelectedStage("new_application");

      // If parent provided jobs, use them directly
      if (availableJobs && availableJobs.length > 0) {
        const filtered = availableJobs.filter(
          (j) => (j.status === "Active" || !j.status) && j.id !== candidate.job_id
        );
        setJobs(filtered);
        setFetchingJobs(false);
      } else {
        // Fetch active jobs from Supabase client directly
        setFetchingJobs(true);
        const fetchJobs = async () => {
          try {
            const supabase = createClient();
            const { data, error: fetchErr } = await supabase
              .from("jobs")
              .select("*")
              .eq("status", "Active")
              .order("created_at", { ascending: false });

            if (fetchErr) {
              console.error("Error fetching active jobs:", fetchErr);
              setError("Failed to load active jobs: " + fetchErr.message);
              return;
            }

            const activeJobs = (data as Job[]) || [];
            setJobs(activeJobs.filter((j) => j.id !== candidate.job_id));
          } catch (err: any) {
            console.error("Error fetching active jobs:", err);
            setError(err?.message || "Failed to load active jobs.");
          } finally {
            setFetchingJobs(false);
          }
        };

        fetchJobs();
      }
    } else {
      // Reset state
      setSelectedJobId("");
      setSelectedStage("new_application");
      setError("");
      setJobs([]);
    }
  }, [isOpen, candidate.job_id, availableJobs]);

  if (!isOpen) return null;

  const handleTransfer = async () => {
    if (!selectedJobId) {
      setError("Please select a target job.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await transferCandidateJob(
        candidate.id,
        selectedJobId,
        selectedStage,
        activeRecruiter?.name || "Recruiter"
      );

      if (result.success) {
        onTransferComplete({
          ...candidate,
          job_id: selectedJobId,
          pipeline_stage: selectedStage,
          ai_summary: null,
          sub_scores: null,
        });
        onClose();
      } else {
        setError(result.error || "Failed to transfer candidate.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800">
            <Briefcase className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-bold">Transfer Candidate</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close transfer modal"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <p className="text-sm text-slate-600 leading-relaxed">
              You are transferring <span className="font-bold text-slate-900">{candidate.first_name} {candidate.last_name}</span>.
              This will reassign them to a new requisition and clear their AI Scorecard so it can be regenerated against the new job description.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Target Job */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Job Requisition
              </label>
              {fetchingJobs ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2.5 px-3 border border-slate-200 rounded-lg bg-slate-50">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" /> Loading active jobs...
                </div>
              ) : jobs.length === 0 && !error ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                  No other active job requisitions available for transfer.
                </div>
              ) : (
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="" disabled>Select a new job...</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Target Stage */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Initial Pipeline Stage
              </label>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
              >
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage.key} value={stage.key}>
                    {stage.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={loading || !selectedJobId || fetchingJobs}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Transfer Candidate <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
