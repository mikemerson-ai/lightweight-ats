"use client";

import { useEffect, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { type DragEndEvent } from "@dnd-kit/core";
import { Star, Sparkles } from "lucide-react";
import {
  getCandidatesByJob,
  updateCandidateStage,
  type Candidate,
} from "@/app/actions/candidates";
import { getEvaluationsByCandidate } from "@/app/actions/evaluations";
import { DndContextWrapper } from "./DndContextWrapper";
import { KanbanColumn } from "./KanbanColumn";
import { DisqualificationModal } from "./DisqualificationModal";
import { ComplianceAlertModal } from "./ComplianceAlertModal";
import { CandidateDetailDrawer } from "@/components/candidates/CandidateDetailDrawer";
import { ScorecardViewerModal } from "@/components/modals/ScorecardViewerModal";
import { getCandidateOriginDate } from "./CandidateCard";

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

function formatRecommendationText(rec: string): string {
  const upper = rec.toUpperCase();
  if (upper.includes("STRONG PURSUE") || upper === "STRONG HIRE") return "Strong Pursue";
  if (upper.includes("CONDITIONAL SCREEN") || upper === "HOLD") return "Conditional Screen";
  if (upper.includes("DO NOT ADVANCE") || upper === "REJECT") return "Do Not Advance";
  if (upper === "HIRE") return "Pursue";
  return rec;
}

function getRecommendationBadgeStyle(rec: string): string {
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

function getFitScoreBadgeStyle(score: number): string {
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
  searchQuery?: string;
  sourceFilter?: "all" | "inbound" | "outbound";
  viewMode?: "kanban" | "list";
}

export interface KanbanBoardRef {
  addCandidate: (newCandidate: Candidate) => void;
  openCandidate: (candidate: Candidate) => void;
  refresh: () => void;
}

export const KanbanBoard = forwardRef<KanbanBoardRef, KanbanBoardProps>(function KanbanBoard({
  jobId,
  searchQuery = "",
  sourceFilter = "all",
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
      const data = await getCandidatesByJob(targetId);
      setCandidates(data);
      setLoadedJobId(targetId);
    } catch {
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
        alert(result.error);
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
      alert("Disqualify failed: " + (result.error ?? "Unknown error"));
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
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
            Loading candidates...
          </div>
        ) : viewMode === "list" ? (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mt-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1140px] table-fixed text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-3.5 py-3.5 w-[135px]">Name</th>
                    <th className="px-3.5 py-3.5 w-[130px]">Stage</th>
                    <th className="px-3.5 py-3.5 w-[260px]">AI Profile Summary</th>
                    <th className="px-3.5 py-3.5 w-[190px]">Three Pillars</th>
                    <th className="px-3.5 py-3.5 w-[150px]">Screening Recommendation</th>
                    <th className="px-3.5 py-3.5 w-[90px]">Overall Fit Score</th>
                    <th className="px-3.5 py-3.5 w-[85px]">Date Applied</th>
                    <th className="px-3.5 py-3.5 w-[100px] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length > 0 ? (
                    filtered.map((candidate) => {
                      const stageObj = PIPELINE_STAGES.find((s) => s.key === candidate.pipeline_stage) || PIPELINE_STAGES[0];
                      const aiScorecard = getCandidateAiScorecard(candidate);
                      return (
                        <tr key={candidate.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="px-3.5 py-3.5 font-medium text-slate-900">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate" title={`${candidate.first_name} ${candidate.last_name}`}>
                                {candidate.first_name} {candidate.last_name}
                              </span>
                              {candidate.dnh_flag && (
                                <span className="shrink-0 rounded-sm bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-700 uppercase leading-none border border-red-200" title="Do Not Hire">
                                  DNH
                                </span>
                              )}
                              {candidate.pending_resume && (
                                <span className="shrink-0 rounded-sm bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700 uppercase leading-none border border-amber-200" title="Pending Resume">
                                  PR
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                              <span className={`h-1.5 w-1.5 rounded-full ${stageObj.accent}`}></span>
                              {stageObj.title}
                            </span>
                          </td>
                          <td className="px-3.5 py-3.5">
                            {candidate.fit_rating != null || candidate.ai_summary ? (
                              <div className="space-y-1.5">
                                {candidate.fit_rating != null && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex items-center">
                                      {[...Array(5)].map((_, i) => (
                                        <Star
                                          key={i}
                                          className={`h-3.5 w-3.5 ${
                                            i < candidate.fit_rating!
                                              ? "fill-amber-400 text-amber-400"
                                              : "fill-slate-100 text-slate-300"
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-xs font-semibold text-slate-700">
                                      {candidate.fit_rating}/5
                                    </span>
                                  </div>
                                )}
                                {candidate.ai_summary ? (
                                  <p
                                    className="text-xs text-slate-600 line-clamp-3 leading-relaxed"
                                    title={candidate.ai_summary}
                                  >
                                    {candidate.ai_summary}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No summary available</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3.5 whitespace-nowrap">
                            {candidate.sub_scores ? (
                              <div className="flex items-center gap-1 text-xs">
                                <span
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 border border-slate-200 shadow-2xs"
                                  title="Functional Experience"
                                >
                                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Exp:</span>
                                  <strong>{candidate.sub_scores.functionalExperience != null ? `${candidate.sub_scores.functionalExperience}/5` : "-"}</strong>
                                </span>
                                <span
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 border border-slate-200 shadow-2xs"
                                  title="Required Credentials"
                                >
                                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Creds:</span>
                                  <strong>{candidate.sub_scores.requiredCredentials != null ? `${candidate.sub_scores.requiredCredentials}/5` : "-"}</strong>
                                </span>
                                <span
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 border border-slate-200 shadow-2xs"
                                  title="Role-Specific Skills"
                                >
                                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Skills:</span>
                                  <strong>{candidate.sub_scores.roleSpecificSkills != null ? `${candidate.sub_scores.roleSpecificSkills}/5` : "-"}</strong>
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">-</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3.5 whitespace-nowrap">
                            {aiScorecard?.recommendation ? (
                              <button
                                type="button"
                                onClick={() => setScorecardCandidate(candidate)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:shadow-xs cursor-pointer ${getRecommendationBadgeStyle(
                                  aiScorecard.recommendation
                                )}`}
                                title="Click to view AI evaluation scorecard"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>{formatRecommendationText(aiScorecard.recommendation)}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setScorecardCandidate(candidate)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-dashed border-slate-300 text-slate-400 hover:text-primary hover:border-primary transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Generate AI Evaluation"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Run Eval</span>
                              </button>
                            )}
                          </td>
                          <td className="px-3.5 py-3.5 whitespace-nowrap">
                            {aiScorecard?.fitScore != null ? (
                              <button
                                type="button"
                                onClick={() => setScorecardCandidate(candidate)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-bold shadow-2xs transition-all hover:shadow-xs cursor-pointer ${getFitScoreBadgeStyle(
                                  aiScorecard.fitScore
                                )}`}
                                title="Click to view AI evaluation scorecard"
                              >
                                <span className="text-xs font-bold">{aiScorecard.fitScore}</span>
                                <span className="text-[10px] font-medium opacity-60">/ 100</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setScorecardCandidate(candidate)}
                                className="inline-flex items-center justify-center px-2.5 py-1 rounded-md border border-dashed border-slate-300 text-slate-400 hover:text-primary hover:border-primary transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Generate AI Evaluation"
                              >
                                <span className="text-xs font-bold">-</span>
                              </button>
                            )}
                          </td>
                          <td className="px-3.5 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                            {(() => {
                              const originInfo = getCandidateOriginDate(candidate);
                              return originInfo.date ? (
                                <span title={`${originInfo.label}: ${originInfo.date}`}>
                                  {originInfo.date}
                                </span>
                              ) : (
                                "-"
                              );
                            })()}
                          </td>
                          <td className="px-3.5 py-3.5 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedCandidate(candidate)}
                              className="text-primary hover:underline font-medium text-xs sm:text-sm"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                        No candidates found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
        onClose={() => setSelectedCandidate(null)}
        onStageChange={(candidate, stage) => handleStageChange(candidate, stage)}
        onCandidateUpdated={(updated) => {
          setSelectedCandidate(updated);
          setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        }}
      />

      <ScorecardViewerModal
        open={Boolean(scorecardCandidate)}
        onClose={() => setScorecardCandidate(null)}
        candidate={scorecardCandidate}
        existingMarkdown={scorecardCandidate ? getCandidateAiScorecard(scorecardCandidate)?.rawNotes || null : null}
        onScorecardGenerated={async () => {
          if (!scorecardCandidate) return;
          const evs = await getEvaluationsByCandidate(scorecardCandidate.id);
          const updated = { ...scorecardCandidate, evaluations: evs };
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