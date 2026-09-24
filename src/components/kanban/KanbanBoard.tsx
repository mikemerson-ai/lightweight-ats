"use client";

import { useEffect, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { type DragEndEvent } from "@dnd-kit/core";
import { Star, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  updateCandidateStage,
  getCandidateById,
  getCandidatesByJob,
  type Candidate,
} from "@/app/actions/candidates";
import type { Job } from "@/app/actions/jobs";
import { getEvaluationsByCandidate } from "@/app/actions/evaluations";
import { DndContextWrapper } from "./DndContextWrapper";
import { KanbanColumn } from "./KanbanColumn";
import { DisqualificationModal } from "./DisqualificationModal";
import { ComplianceAlertModal } from "./ComplianceAlertModal";
import { CandidateDetailDrawer } from "@/components/candidates/CandidateDetailDrawer";
import { ScorecardViewerModal } from "@/components/modals/ScorecardViewerModal";
import { getCandidateOriginDate } from "./CandidateCard";
import { TableView } from "./TableView";

export function getCandidateAiScorecard(candidate: Candidate) {
  if (!candidate.evaluations || candidate.evaluations.length === 0) {
    return null;
  }

  const aiEval = candidate.evaluations.find(
    (ev) =>
      ev.reviewer_name?.toLowerCase().includes("ai") ||
      ev.notes?.includes("Candidate Screening Summary") ||
      ev.notes?.includes("Hard Gate")
  );

  if (!aiEval) {
    return null;
  }

  let recommendation: string | null = null;
  let fitScore: number | null = null;

  if (aiEval.notes) {
    const recMatch = aiEval.notes.match(
      /(?:Match|Screening)\s+Recommendation:\s*\*?\*?\s*([A-Za-z\s]+?)(?:\r?\n|\*|$)/i
    );
    if (recMatch && recMatch[1].trim()) {
      recommendation = recMatch[1].trim();
    }

    const scoreMatch = aiEval.notes.match(
      /Overall Fit Score:\s*\*?\*?\s*(\d{1,3})/i
    );
    if (scoreMatch && scoreMatch[1]) {
      fitScore = parseInt(scoreMatch[1], 10);
    }
  }

  if (!recommendation && aiEval.recommendation) {
    recommendation = aiEval.recommendation;
  }

  if (fitScore === null && aiEval.aggregate_score != null) {
    fitScore = Math.round(aiEval.aggregate_score * 20);
  }

  return {
    recommendation,
    fitScore,
    rawNotes: aiEval.notes,
  };
}

export function formatRecommendationText(rec: string): string {
  const upper = rec.toUpperCase();
  if (upper.includes("STRONG PURSUE") || upper === "STRONG HIRE") return "Strong Pursue";
  if (upper.includes("CONDITIONAL SCREEN") || upper === "HOLD") return "Conditional Screen";
  if (upper.includes("DO NOT ADVANCE") || upper === "REJECT") return "Do Not Advance";
  if (upper === "HIRE") return "Pursue";
  return rec;
}

export function getRecommendationBadgeStyle(rec: string): string {
  const upper = rec.toUpperCase();
  if (upper.includes("STRONG PURSUE") || upper === "STRONG HIRE") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100";
  }
  if (upper.includes("CONDITIONAL SCREEN") || upper === "HOLD" || upper === "HIRE") {
    return "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100";
  }
  if (upper.includes("DO NOT ADVANCE") || upper === "REJECT") {
    return "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100";
  }
  return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200";
}

export function getFitScoreBadgeStyle(score: number): string {
  if (score >= 80) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100";
  }
  if (score >= 60) {
    return "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100";
  }
  return "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100";
}

export interface PipelineStage {
  key: string;
  title: string;
  accent: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    key: "new_application",
    title: "New Application",
    accent: "bg-secondary",
  },
  { key: "reviewing", title: "Reviewing", accent: "bg-secondary" },
  { key: "screening", title: "Screening", accent: "bg-secondary" },
  { key: "interview", title: "Interview", accent: "bg-secondary" },
  {
    key: "completing_requirements",
    title: "Completing Requirements",
    accent: "bg-secondary",
  },
  { key: "offer", title: "Offer", accent: "bg-secondary" },
  {
    key: "background_checks",
    title: "Background Checks",
    accent: "bg-secondary",
  },
  { key: "hired", title: "Hired", accent: "bg-success" },
  { key: "disqualified", title: "Rejected", accent: "bg-danger" },
];

export interface KanbanBoardProps {
  jobId: string | null;
  availableJobs?: Job[];
  searchQuery?: string;
  sourceFilter?: "all" | "inbound" | "outbound";
  temperatureFilter?: "all" | "hot" | "warm" | "cold" | "unset";
  viewMode?: "kanban" | "list";
}

export interface KanbanBoardRef {
  addCandidate: (newCandidate: Candidate) => void;
  openCandidate: (candidate: Candidate) => void;
  refresh: () => void;
}

export const KanbanBoard = forwardRef<KanbanBoardRef, KanbanBoardProps>(function KanbanBoard({
  jobId,
  availableJobs,
  searchQuery = "",
  sourceFilter = "all",
  temperatureFilter = "all",
  viewMode = "kanban",
}, ref) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadedJobId, setLoadedJobId] = useState<string | null>(null);

  const [disqualifyModalOpen, setDisqualifyModalOpen] = useState(false);
  const [candidateToDisqualify, setCandidateToDisqualify] = useState<Candidate | null>(null);

  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [missingComplianceItems, setMissingComplianceItems] = useState<string[]>([]);

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [scorecardCandidate, setScorecardCandidate] = useState<Candidate | null>(null);

  const loadCandidates = useCallback(async (targetId: string) => {
    try {
      const response = await getCandidatesByJob(targetId);
      if (response.error) {
        toast.error(`Load candidates failed: ${response.error}`);
        setCandidates([]);
      } else {
        setCandidates(response.data || []);
      }
      setLoadedJobId(targetId);
    } catch (err: any) {
      console.error("Error loading candidates in Kanban:", err);
      toast.error(`Load candidates exception: ${err.message || 'Unknown error'}`);
      setCandidates([]);
      setLoadedJobId(targetId);
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      return;
    }
    loadCandidates(jobId);
  }, [jobId, loadCandidates]);

  useImperativeHandle(ref, () => ({
    addCandidate: (newCandidate) => {
      setCandidates((prev) => [newCandidate, ...prev.filter(c => c.id !== newCandidate.id)]);
    },
    openCandidate: (candidate) => {
      setSelectedCandidate(candidate);
    },
    refresh: () => {
      if (jobId) {
        loadCandidates(jobId);
      }
    },
  }));

  const loading = Boolean(jobId && loadedJobId !== jobId);

  const filtered = candidates
    .filter((candidate) => {
      if (sourceFilter !== "all") {
        const sourceType =
          candidate.source_type ||
          (candidate.source_channel === "Employee Referral"
            ? "outbound"
            : "inbound");
        if (sourceType !== sourceFilter) {
          return false;
        }
      }
      if (temperatureFilter !== "all") {
        if (temperatureFilter === "unset") {
          if (candidate.temperature) return false;
        } else {
          if (candidate.temperature !== temperatureFilter) return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const haystack = [
          candidate.first_name,
          candidate.last_name,
          candidate.email,
          candidate.primary_skills,
          candidate.status_tag,
          candidate.ai_summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = a.date_applied || a.date_sourced || a.created_at;
      const dateB = b.date_applied || b.date_sourced || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  function groupByStage(): Record<string, Candidate[]> {
    const grouped: Record<string, Candidate[]> = {};
    for (const stage of PIPELINE_STAGES) {
      grouped[stage.key] = [];
    }
    for (const candidate of filtered) {
      const key = candidate.pipeline_stage || "new_application";
      grouped[key] = grouped[key] ? [...grouped[key], candidate] : [candidate];
    }
    return grouped;
  }

  const grouped = groupByStage();

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) {
      return;
    }

    const moved = candidates.find((c) => c.id === activeId);
    if (!moved) {
      return;
    }

    const activeIsStage = PIPELINE_STAGES.some((s) => s.key === activeId);
    const overIsStage = PIPELINE_STAGES.some((s) => s.key === overId);
    if (activeIsStage || overIsStage) {
      return;
    }

    const sourceId = moved.pipeline_stage || "new_application";
    const overCard = candidates.find((c) => c.id === overId);
    const targetId = overCard
      ? overCard.pipeline_stage || "new_application"
      : overId;

    if (sourceId === targetId) {
      return;
    }

    await handleStageChange(moved, targetId);
  }

  async function handleStageChange(candidate: Candidate, targetId: string) {
    if (targetId === "disqualified") {
      setCandidateToDisqualify(candidate);
      setDisqualifyModalOpen(true);
      return;
    }

    const result = await updateCandidateStage(candidate.id, targetId);

    if (!result.success) {
      if (result.blocked) {
        setMissingComplianceItems([
          ...(result.missingDocs ?? []),
          ...(result.expiredDocs ?? []),
        ]);
        setComplianceModalOpen(true);
      } else if (result.error) {
        toast.error(result.error);
      }
      return;
    }

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidate.id ? { ...c, pipeline_stage: targetId } : c,
      ),
    );
    if (selectedCandidate?.id === candidate.id) {
      setSelectedCandidate((prev) => prev ? { ...prev, pipeline_stage: targetId } : null);
    }
  }

  async function handleDisqualifyConfirm(reason: string) {
    if (!candidateToDisqualify) return;
    
    const moved = candidateToDisqualify;
    const targetId = "disqualified";

    setDisqualifyModalOpen(false);
    setCandidateToDisqualify(null);

    const result = await updateCandidateStage(
      moved.id,
      targetId,
      reason,
    );

    if (!result.success) {
      console.error("Disqualify failed:", result.error);
      toast.error("Disqualify failed: " + (result.error ?? "Unknown error"));
      return;
    }

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === moved.id ? { ...c, pipeline_stage: targetId } : c,
      ),
    );
    if (selectedCandidate?.id === moved.id) {
      setSelectedCandidate((prev) => prev ? { ...prev, pipeline_stage: targetId } : null);
    }
  }

  return (
    <>
      <DndContextWrapper onDragEnd={handleDragEnd}>
        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-3 h-[calc(100vh-140px)] animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50 shadow-sm h-full">
                <div className="flex shrink-0 items-center justify-between rounded-t-lg border-b bg-card px-4 py-2.5">
                  <div className="h-4 w-24 bg-slate-200 rounded"></div>
                  <div className="h-5 w-8 bg-slate-200 rounded-full"></div>
                </div>
                <div className="flex-1 px-3 py-3 space-y-2.5">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-24 w-full bg-white rounded-md border border-slate-200 shadow-sm p-3 flex flex-col justify-between">
                      <div className="h-3 w-1/2 bg-slate-200 rounded"></div>
                      <div className="flex gap-2">
                        <div className="h-4 w-4 bg-slate-200 rounded"></div>
                        <div className="h-4 w-4 bg-slate-200 rounded"></div>
                      </div>
                      <div className="h-2 w-1/3 bg-slate-200 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "list" ? (
          <TableView
            candidates={filtered}
            onSelectCandidate={setSelectedCandidate}
            onGenerateScorecard={setScorecardCandidate}
          />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-3 h-[calc(100vh-140px)]">
            {PIPELINE_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.key}
                id={stage.key}
                title={stage.title}
                accent={stage.accent}
                candidates={grouped[stage.key] ?? []}
                onSelect={setSelectedCandidate}
              />
            ))}
          </div>
        )}
      </DndContextWrapper>

      <DisqualificationModal
        candidate={candidateToDisqualify}
        isOpen={disqualifyModalOpen}
        onClose={() => {
          setDisqualifyModalOpen(false);
          setCandidateToDisqualify(null);
        }}
        onConfirm={handleDisqualifyConfirm}
      />

      <ComplianceAlertModal
        isOpen={complianceModalOpen}
        onClose={() => setComplianceModalOpen(false)}
        missingItems={missingComplianceItems}
      />

      <CandidateDetailDrawer
        candidate={selectedCandidate}
        availableJobs={availableJobs}
        onClose={() => setSelectedCandidate(null)}
        onStageChange={(candidate, stage) => handleStageChange(candidate, stage)}
        onCandidateUpdated={(updated) => {
          if (updated.job_id !== jobId) {
            setSelectedCandidate(null);
            setCandidates((prev) => prev.filter((c) => c.id !== updated.id));
          } else {
            setSelectedCandidate(updated);
            setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }
        }}
      />

      <ScorecardViewerModal
        open={Boolean(scorecardCandidate)}
        onClose={() => setScorecardCandidate(null)}
        candidate={scorecardCandidate}
        existingMarkdown={scorecardCandidate ? getCandidateAiScorecard(scorecardCandidate)?.rawNotes || null : null}
        onScorecardGenerated={async (_markdown, updatedCandidate) => {
          if (!scorecardCandidate) return;
          const [evs, freshCandidate] = await Promise.all([
            getEvaluationsByCandidate(scorecardCandidate.id),
            getCandidateById(scorecardCandidate.id),
          ]);
          const base = freshCandidate || updatedCandidate || scorecardCandidate;
          const updated = { ...base, evaluations: evs };
          setScorecardCandidate(updated);
          setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          if (selectedCandidate?.id === updated.id) {
            setSelectedCandidate(updated);
          }
        }}
      />
    </>
  );
});