"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Candidate } from "@/app/actions/candidates";
import { CandidateCard } from "./CandidateCard";

export interface KanbanColumnProps {
  id: string;
  title: string;
  accent: string;
  isOverlay?: boolean;
  candidates: Candidate[];
  onSelect?: (candidate: Candidate) => void;
}

export function KanbanColumn({
  id,
  title,
  accent,
  isOverlay = false,
  candidates,
  onSelect,
}: KanbanColumnProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      className={[
        "flex w-72 shrink-0 flex-col rounded-xl border",
        isOver && !isOverlay
          ? "border-secondary bg-secondary/10"
          : "border-slate-200 bg-slate-50",
        isDragging && !isOverlay ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between rounded-t-lg border-b bg-card px-4 py-2.5">
        <span className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
          <span className="text-sm font-semibold text-primary">{title}</span>
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {candidates.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-3 py-3">
        {candidates.length > 0 ? (
          candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onSelect={onSelect}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-xs font-medium text-slate-500">
            Drop candidates here
          </div>
        )}
      </div>
    </div>
  );
}