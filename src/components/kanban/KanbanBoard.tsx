"use client";

import { useEffect, useState } from "react";
import { type DragEndEvent } from "@dnd-kit/core";
import {
  getCandidatesByJob,
  updateCandidateStage,
  checkCandidateCompliance,
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
  { key: "disqualified", title: "Disqualified", accent: "bg-danger" },
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

  const filtered = candidates.filter((candidate) => {
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

    if (targetId === "hired") {
      try {
        const check = await checkCandidateCompliance(moved.id);
        if (!check.compliant) {
          setMissingComplianceItems(check.missing_items || []);
          setComplianceModalOpen(true);
          return;
        }
      } catch (err) {
        console.error("Compliance check failed", err);
        return;
      }
    }

    if (targetId === "disqualified") {
      setCandidateToDisqualify(moved);
      setDisqualifyModalOpen(true);
      return;
    }

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === moved.id ? { ...c, pipeline_stage: targetId } : c,
      ),
    );

    try {
      await updateCandidateStage(moved.id, targetId);
    } catch (err) {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === moved.id ? { ...c, pipeline_stage: sourceId } : c,
        ),
      );
    }
  }

  async function handleDisqualifyConfirm(reason: string) {
    if (!candidateToDisqualify) return;
    
    const moved = candidateToDisqualify;
    const sourceId = moved.pipeline_stage || "new_application";
    const targetId = "disqualified";

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === moved.id ? { ...c, pipeline_stage: targetId } : c,
      ),
    );

    setDisqualifyModalOpen(false);
    setCandidateToDisqualify(null);

    try {
      await updateCandidateStage(moved.id, targetId, reason);
    } catch (err) {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === moved.id ? { ...c, pipeline_stage: sourceId } : c,
        ),
      );
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
      />
    </>
  );
}