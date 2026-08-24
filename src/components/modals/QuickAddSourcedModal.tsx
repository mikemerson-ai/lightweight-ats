"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { quickAddSourcedCandidate } from "@/app/actions/candidates";
import { SOURCING_CHANNELS, APPLIED_CHANNELS } from "@/lib/constants";
import { parseResumeAction } from "@/app/actions/resumeParser";
import type { ParsedCandidate } from "@/lib/gemini/parser";
import { getJobs, type Job } from "@/app/actions/jobs";
import { useRecruiter } from "@/context/RecruiterContext";

interface QuickAddSourcedModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddSourcedModal({
  open,
  onClose,
}: QuickAddSourcedModalProps) {
  const [fullName, setFullName] = useState("");
  const [candidateOrigin, setCandidateOrigin] = useState<"sourced" | "applied">("applied");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [sourceChannel, setSourceChannel] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [primarySkills, setPrimarySkills] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [suggestedRoleFit, setSuggestedRoleFit] = useState("");
  const [outreachNotes, setOutreachNotes] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resume, setResume] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const { activeRecruiter } = useRecruiter();

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
    setCandidateOrigin("applied");
    setEventDate(new Date().toISOString().split("T")[0]);
    setSourceChannel("");
    setTargetJob("");
    setContactInfo("");
    setEmail("");
    setPhone("");
    setPrimarySkills("");
    setYearsOfExperience("");
    setAiSummary("");
    setSuggestedRoleFit("");
    setOutreachNotes("");
    setResume(null);
    setDragging(false);
    setParsing(false);
    setError("");
  }

  function applyParsedData(data: ParsedCandidate) {
    const parsedName = [data.firstName, data.lastName].filter(Boolean).join(" ");
    if (parsedName) setFullName(parsedName);
    if (data.email) setEmail(data.email);
    if (data.phone) setPhone(data.phone);
    if (data.primarySkills?.length) {
      setPrimarySkills(data.primarySkills.join(", "));
    }
    const summary = data.summary ?? "";
    if (summary) setAiSummary(summary);
    const roleFit = data.suggestedRoleFit ?? "";
    if (roleFit) setSuggestedRoleFit(roleFit);
    if (typeof data.yearsOfExperience === "number") {
      setYearsOfExperience(String(data.yearsOfExperience));
    }
    const notes = [summary, roleFit ? `Suggested Role Fit: ${roleFit}` : ""]
      .filter(Boolean)
      .join("\n\n");
    if (notes) setOutreachNotes(notes);
  }

  async function handleFile(file: File | undefined) {
    if (!file) {
      setError("");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "docx", "txt"].includes(extension)) {
      setError("Please attach a PDF, DOCX, or TXT file.");
      return;
    }
    setResume(file);
    setError("");
    setParsing(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await parseResumeAction(formData);
      if (!result.success || !result.data) {
        setError(result.error ?? "AI could not parse this resume. Please fill the fields manually.");
        return;
      }
      applyParsedData(result.data);
    } catch {
      setError("Something went wrong while parsing the resume. Please try again.");
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit() {
    if (!firstName || !sourceChannel || !targetJob) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await quickAddSourcedCandidate({
        first_name: firstName,
        last_name: lastName,
        source_channel: sourceChannel,
        source_type: candidateOrigin,
        pending_resume: !resume,
        date_applied: candidateOrigin === "applied" ? eventDate : undefined,
        date_sourced: candidateOrigin === "sourced" ? eventDate : undefined,
        job_id: targetJob,
        contact_info: contactInfo || email || phone || "Not Provided",
        linkedin_url: contactInfo,
        email: email,
        phone: phone,
        primary_skills: primarySkills,
        years_of_experience: yearsOfExperience
          ? Number(yearsOfExperience)
          : null,
        ai_summary: aiSummary,
        suggested_role_fit: suggestedRoleFit,
        outreach_notes: outreachNotes,
        author_name: activeRecruiter?.name || "Recruiter",
      });
      reset();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border bg-white shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between bg-primary px-5 py-4">
          <h2 className="text-lg font-semibold text-white">
            Quick-Add Candidate
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
            <span className="text-sm font-medium text-primary">Candidate Type *</span>
            <div className="flex rounded-md border border-slate-300 overflow-hidden bg-white">
              <button
                type="button"
                className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                  candidateOrigin === "applied"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setCandidateOrigin("applied");
                  setSourceChannel("");
                }}
              >
                Applied
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                  candidateOrigin === "sourced"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setCandidateOrigin("sourced");
                  setSourceChannel("");
                }}
              >
                Sourced
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              {candidateOrigin === "applied" ? "Date Applied *" : "Date Sourced *"}
            </span>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
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
              {(candidateOrigin === "applied" ? APPLIED_CHANNELS : SOURCING_CHANNELS).map((channel) => (
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
              LinkedIn Profile URL
            </span>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-primary">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@example.com"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-primary">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              Primary Skills
            </span>
            <input
              type="text"
              value={primarySkills}
              onChange={(e) => setPrimarySkills(e.target.value)}
              placeholder="e.g. React, TypeScript, Leadership"
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
            } ${parsing ? "opacity-60" : ""}`}
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
            onClick={() => !parsing && fileInputRef.current?.click()}
          >
            {parsing ? (
              <>
                <Loader2 className="h-6 w-6 text-secondary animate-spin" />
                <span className="font-medium text-primary">
                  AI Parsing with Gemini 2.5 Flash...
                </span>
                <span className="text-secondary/80">Extracting candidate details</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-secondary" />
                {resume ? (
                  <span className="font-medium text-primary">{resume.name}</span>
                ) : (
                  <>
                    <span className="font-medium">
                      Drag resume here (PDF, DOCX, TXT)
                    </span>
                    <span className="text-slate-400">or click to browse</span>
                  </>
                )}
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
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