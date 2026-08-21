"use client";

import { useEffect, useRef, useState } from "react";
import { XUp, X } from "lucide-react";
import {
  SOURCING_CHANNELS,
  quickAddSourcedCandidate,
} from "@/app/actions/candidates";
import { getJobs, type Job } from "@/app/actions/jobs";

interface QuickAddSourcedModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddSourcedModal({
  open,
  onClose,
}: QuickAddSourcedModalProps) {
  const [fullName, setFullName] = useState("");
  const [sourceChannel, setSourceChannel] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [outreachNotes, setOutreachNotes] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resume, setResume] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      getJobs()
        .then((activeJobs) =>
          setJobs(activeJobs.filter((job) => job.status === "Active")),
        )
        .catch(() => setJobs([]));
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || firstName;

  function reset() {
    setFullName("");
    setSourceChannel("");
    setTargetJob("");
    setContactInfo("");
    setOutreachNotes("");
    setResume(null);
    setDragging(false);
    setError("");
  }

  function handleFile(file: File | undefined) {
    if (file && file.type !== "application/pdf") {
      setError("Please attach a PDF file.");
      return;
    }
    setResume(file ?? null);
    setError("");
  }

  async function handleSubmit() {
    if (!firstName || !sourceChannel || !targetJob || !contactInfo) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await quickAddSourcedCandidate({
        first_name: firstName,
        last_name: lastName,
        source_channel: sourceChannel as (typeof SOURCING_CHANNELS)[number],
        job_id: targetJob,
        contact_info: contactInfo,
        outreach_notes: outreachNotes,
      });
      reset();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "rounded-md border bg-primary-foreground px-3 py-2 text-sm focus:border-secondary focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border bg-white shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between bg-primary px-5 py-4">
          <h2 className="text-lg font-semibold text-white">
            Quick-Add Sourced Candidate
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="text-white hover:text-white/70"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 bg-slate-50 p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">Full Name *</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              Sourcing Channel *
            </span>
            <select
              value={sourceChannel}
              onChange={(e) => setSourceChannel(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a channel</option>
              {SOURCING_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              Target Job Opening *
            </span>
            <select
              value={targetJob}
              onChange={(e) => setTargetJob(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              Contact Info / Profile URL *
            </span>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Email, phone, or LinkedIn profile"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              Recruiter Outreach Notes
            </span>
            <textarea
              value={outreachNotes}
              onChange={(e) => setOutreachNotes(e.target.value)}
              rows={3}
              placeholder="Initial conversation context, salary expectations, or outreach status..."
              className={`${inputClass} resize-none`}
            />
          </label>

          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm ${
              dragging ? "border-secondary bg-secondary/10" : "border-slate-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <XUp className="h-6 w-6 text-secondary" />
            {resume ? (
              <span className="font-medium text-primary">{resume.name}</span>
            ) : (
              <>
                <span className="font-medium">Drag resume PDF here</span>
                <span className="text-slate-400">or click to browse</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Saving..." : "Add Candidate"}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}