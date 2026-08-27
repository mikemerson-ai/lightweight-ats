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

export function formatCandidateDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString();
  }
  return dateStr;
}

export function getCandidateOriginDate(candidate: Candidate): { label: string; date: string } {
  const isSourced = candidate.source_type === "outbound" || candidate.source_type === "sourced";
  const rawDate = isSourced
    ? (candidate.date_sourced || candidate.created_at)
    : (candidate.date_applied || candidate.created_at);
  return {
    label: isSourced ? "Sourced" : "Applied",
    date: formatCandidateDate(rawDate),
  };
}

export function sourceBadgeLabel(candidate: Candidate): string {
  let channel = candidate.source_channel || (candidate.source_type === "outbound" || candidate.source_type === "sourced" ? "Sourced" : "Applied");
  if (channel === "LinkedIn Recruiter" || channel === "LinkedIn InMail") channel = "LinkedIn";
  if (channel === "Indeed Resume Database" || channel === "Indeed Resume") channel = "Indeed";
  return channel;
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
  const originInfo = getCandidateOriginDate(candidate);

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
        "shrink-0 rounded-md border bg-white p-2 shadow-sm cursor-pointer relative overflow-hidden group",
        isDragging ? "ring-2 ring-secondary" : "cursor-grab active:cursor-grabbing hover:border-slate-300",
      ].join(" ")}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
          badgeVariant === 'inbound' ? 'bg-emerald-500' :
          badgeVariant === 'sourced' ? 'bg-blue-500' : 'bg-amber-500'
      }`} title={`Source: ${sourceBadgeLabel(candidate)}${originInfo.date ? ` (${originInfo.label}: ${originInfo.date})` : ''}`} />
      
      <div className="flex items-center justify-between gap-2 pl-1.5">
        <span className="text-[13px] font-medium text-slate-700 truncate group-hover:text-primary transition-colors">
          {candidate.first_name} {candidate.last_name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {candidate.dnh_flag && (
            <span className="rounded-sm bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-700 uppercase leading-none border border-red-200" title="Do Not Hire">
              DNH
            </span>
          )}
          {candidate.pending_resume && (
            <span className="rounded-sm bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700 uppercase leading-none border border-amber-200" title="Pending Resume">
              PR
            </span>
          )}
        </div>
      </div>
      {originInfo.date && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 pl-1.5 mt-0.5">
          <span className="truncate">{candidate.jobs?.title || "General"}</span>
          <span className="shrink-0 text-[10.5px] text-slate-400 font-normal">
            {originInfo.date}
          </span>
        </div>
      )}
    </div>
  );
}