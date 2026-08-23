"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock } from "lucide-react";
import { type Candidate } from "@/app/actions/candidates";

export type SourceBadgeVariant = "inbound" | "sourced" | "referral";

export function getSourceBadgeVariant(candidate: Candidate): SourceBadgeVariant {
  if (candidate.source_type === "outbound" || candidate.source_type === "sourced") {
    return "sourced";
  }
  return "inbound";
}

function formatOriginDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return "";
  return `: ${parts[1]}/${parts[2]}/${parts[0]}`;
}

export function sourceBadgeLabel(candidate: Candidate): string {
  if (candidate.source_type === "outbound" || candidate.source_type === "sourced") {
    return `Sourced${formatOriginDate(candidate.date_sourced)}`;
  }
  return `Applied${formatOriginDate(candidate.date_applied)}`;
}

const BADGE_STYLES: Record<SourceBadgeVariant, string> = {
  inbound:
    "rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white",
  sourced:
    "rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white",
  referral:
    "rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white",
};

export function daysInStage(candidate: Candidate, now = Date.now()): number {
  const from = new Date(candidate.updated_at ?? candidate.created_at).getTime();
  if (Number.isNaN(from)) {
    return 0;
  }
  return Math.max(0, Math.floor((now - from) / 86_400_000));
}

export function CandidateCard({
  candidate,
  onSelect,
}: {
  candidate: Candidate;
  onSelect?: (candidate: Candidate) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: candidate.id });

  const badgeVariant = getSourceBadgeVariant(candidate);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onSelect?.(candidate)}
      className={[
        "rounded-lg border bg-white p-3 shadow-sm cursor-pointer",
        isDragging ? "ring-2 ring-secondary" : "cursor-grab active:cursor-grabbing",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-primary">
          {candidate.first_name} {candidate.last_name}
        </span>
        <span className={BADGE_STYLES[badgeVariant]}>
          {sourceBadgeLabel(candidate)}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {candidate.jobs?.title ?? "No job assigned"}
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
        <Clock className="h-3 w-3" />
        {daysInStage(candidate)}d in stage
      </div>
    </div>
  );
}