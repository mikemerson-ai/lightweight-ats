"use client";

import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { type DragEndEvent } from "@dnd-kit/core";
import {
  getCandidatesByJob,
  updateCandidateStage,
  type Candidate,
} from "@/app/actions/candidates";
import { DndContextWrapper } from "./DndContextWrapper";
import { KanbanColumn } from "./KanbanColumn";
import { DisqualificationModal } from "./DisqualificationModal";
import { ComplianceAlertModal } from "./ComplianceAlertModal";
import { CandidateDetailDrawer } from "@/components/candidates/CandidateDetailDrawer";
import { getCandidateOriginDate } from "./CandidateCard";

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

  useImperativeHandle(ref, () => ({
    addCandidate: (newCandidate) => {
      setCandidates((prev) => [newCandidate, ...prev.filter(c => c.id !== newCandidate.id)]);
    },
    openCandidate: (candidate) => {
      setSelectedCandidate(candidate);
    }
  }));

  useEffect(() => {
    if (!jobId) {
      return;
    }
    getCandidatesByJob(jobId)
      .then((data) => {
        setCandidates(data);
        setLoadedJobId(jobId);
      })
      .catch(() => {
        setCandidates([]);
        setLoadedJobId(jobId);
      });
  }, [jobId]);

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
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Stage</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Date Applied</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length > 0 ? (
                    filtered.map((candidate) => {
                      const stageObj = PIPELINE_STAGES.find((s) => s.key === candidate.pipeline_stage) || PIPELINE_STAGES[0];
                      return (
                        <tr key={candidate.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {candidate.first_name} {candidate.last_name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                              <span className={`h-1.5 w-1.5 rounded-full ${stageObj.accent}`}></span>
                              {stageObj.title}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{candidate.email}</td>
                          <td className="px-6 py-4 text-slate-500">
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
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => setSelectedCandidate(candidate)}
                              className="text-primary hover:underline font-medium"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
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
      />
    </>
  );
});