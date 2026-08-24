"use client";

import { useEffect, useState } from "react";
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
}

export function KanbanBoard({
  jobId,
  searchQuery = "",
  sourceFilter = "all",
}: KanbanBoardProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadedJobId, setLoadedJobId] = useState<string | null>(null);

  const [disqualifyModalOpen, setDisqualifyModalOpen] = useState(false);
  const [candidateToDisqualify, setCandidateToDisqualify] = useState<Candidate | null>(null);

  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [missingComplianceItems, setMissingComplianceItems] = useState<string[]>([]);

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

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
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-3">
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
}