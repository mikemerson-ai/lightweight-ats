"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Mail, Phone, X } from "lucide-react";
import {
  type Candidate,
  getCandidateActivity,
  getCandidateDocuments,
  type ActivityLogEntry,
  type ComplianceDocument,
} from "@/app/actions/candidates";
import {
  getSourceBadgeVariant,
  sourceBadgeLabel,
} from "@/components/kanban/CandidateCard";

const STAGE_TITLES: Record<string, string> = {
  new_application: "New Application",
  screening: "Screening",
  interview: "Interview",
  completing_requirements: "Completing Requirements",
  offer: "Offer",
  background_checks: "Background Checks",
  hired: "Hired",
  disqualified: "Disqualified",
};

const BADGE_VARIANT_STYLES: Record<string, string> = {
  inbound:
    "rounded-full border border-primary/30 bg-slate-50 px-2 py-0.5 text-xs font-medium text-primary",
  sourced: "rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-white",
  referral:
    "rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white",
};

function statusStyle(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("submitted") || normalized.includes("received")) {
    return "bg-success/10 text-success";
  }
  if (normalized.includes("pending") || normalized.includes("required")) {
    return "bg-warning/10 text-warning";
  }
  if (normalized.includes("expired")) {
    return "bg-danger/10 text-danger";
  }
  return "bg-primary/10 text-primary";
}

function statusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("mandatory")) return "Mandatory";
  if (normalized.includes("expired")) return "Expired";
  if (normalized.includes("submitted")) return "Submitted";
  if (normalized.includes("received")) return "Submitted";
  return status || "Pending";
}

interface CandidateDetailDrawerProps {
  candidate: Candidate | null;
  onClose: () => void;
}

export function CandidateDetailDrawer({
  candidate,
  onClose,
}: CandidateDetailDrawerProps) {
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [activeTab, setActiveTab] = useState<"compliance" | "activity">(
    "activity",
  );

  useEffect(() => {
    if (!candidate) {
      setActivity([]);
      setDocuments([]);
      return;
    }
    getCandidateActivity(candidate.id)
      .then(setActivity)
      .catch(() => setActivity([]));
    getCandidateDocuments(candidate.id)
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, [candidate]);

  const skills =
    candidate?.primary_skills
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  return (
    <div
      className={`fixed inset-0 z-50 transition-all ${
        candidate ? "visible" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        className="absolute inset-0 bg-primary/50 transition-opacity"
        onClick={onClose}
      />
      {candidate && (
        <aside className="absolute right-0 top-0 h-full w-full max-w-md translate-x-0 bg-white shadow-lg flex flex-col">
          <div className="flex flex-col gap-0 bg-primary px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{candidate.first_name} {candidate.last_name}</h2>
              <button
                type="button"
                aria-label="Close profile"
                className="text-white hover:text-white/70"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-secondary/90">
                {candidate.jobs?.title ?? "No job assigned"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-white">
                {STAGE_TITLES[candidate.current_stage] ?? candidate.current_stage}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_VARIANT_STYLES[getSourceBadgeVariant(candidate)]}`}
              >
                {sourceBadgeLabel(candidate)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/90">
              {candidate.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {candidate.email}
                </span>
              )}
              {candidate.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {candidate.phone}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col gap-6 p-6">
            <section className="rounded-xl border bg-white p-5">
              <h3 className="text-sm font-semibold text-primary">
                AI Fit Summary
              </h3>
              <p className="mt-3 text-sm text-slate-700">
                {candidate.ai_summary || "No AI summary available for this candidate yet."}
              </p>
              {candidate.suggested_role_fit && (
                <p className="mt-2 text-sm">
                  <span className="font-medium text-primary">Suggested Role Fit:</span>{" "}
                  <span className="text-slate-700">{candidate.suggested_role_fit}</span>
                </p>
              )}
              {candidate.years_of_experience != null &&
                candidate.years_of_experience > 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    <span className="font-medium text-primary">Experience:</span>{" "}
                    {candidate.years_of_experience} yrs
                  </p>
                )}
              {skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border bg-white p-5">
              <div className="flex gap-4 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  className={`text-sm font-medium pb-1 ${
                    activeTab === "activity"
                      ? "text-primary border-b-2 border-primary"
                      : "text-slate-500"
                  }`}
                  onClick={() => setActiveTab("activity")}
                >
                  Activity Timeline
                </button>
                <button
                  type="button"
                  className={`text-sm font-medium pb-1 ${
                    activeTab === "compliance"
                      ? "text-primary border-b-2 border-primary"
                      : "text-slate-500"
                  }`}
                  onClick={() => setActiveTab("compliance")}
                >
                  Compliance Checklist
                </button>
              </div>

              {activeTab === "activity" ? (
                <div className="mt-3 flex flex-col gap-3">
                  {activity.length > 0 ? (
                    activity.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <CalendarClock className="h-3 w-3" />
                          {new Date(entry.created_at).toLocaleString()}
                        </div>
                        <p className="mt-1.5 text-sm text-slate-700">
                          {entry.notes || entry.activity_type}
                        </p>
                        <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {entry.activity_type.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      No activity logged yet for this candidate.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {documents.length > 0 ? (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2.5"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-primary">
                            {doc.item_name}
                          </span>
                          {doc.category && (
                            <span className="text-xs text-slate-400">
                              {doc.category}
                            </span>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle(doc.status)}`}
                        >
                          {statusLabel(doc.status)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      No required documents tracked yet for this candidate.
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        </aside>
      )}
    </div>
  );
}