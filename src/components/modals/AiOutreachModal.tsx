"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  Mail,
  FileText,
  Copy,
  Check,
  Send,
  Loader2,
  ExternalLink,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function LinkedInIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} fill-current`} viewBox="0 0 24 24">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0-.02-3.28 1.64 1.64 0 0 0 .02 3.28m1.39 9.74v-8.37H5.07v8.37h2.78z" />
    </svg>
  );
}
import { type Candidate } from "@/app/actions/candidates";
import {
  generateCandidateOutreachAction,
  logCandidateOutreachActivity,
} from "@/app/actions/outreach";
import {
  type OutreachChannel,
  type OutreachTone,
  type OutreachResult,
} from "@/lib/gemini/outreachGenerator";
import { useRecruiter } from "@/context/RecruiterContext";

interface AiOutreachModalProps {
  open: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  onActivityLogged?: () => void;
}

export function AiOutreachModal({
  open,
  onClose,
  candidate,
  onActivityLogged,
}: AiOutreachModalProps) {
  const { activeRecruiter } = useRecruiter();

  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [tone, setTone] = useState<OutreachTone>("professional");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [outreachResult, setOutreachResult] = useState<OutreachResult | null>(null);
  const [editableSubject, setEditableSubject] = useState<string>("");
  const [editableBody, setEditableBody] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [copiedSubject, setCopiedSubject] = useState<boolean>(false);
  const [copiedBody, setCopiedBody] = useState<boolean>(false);
  const [isLogging, setIsLogging] = useState<boolean>(false);
  const [loggedSuccess, setLoggedSuccess] = useState<boolean>(false);

  if (!open || !candidate) return null;

  const candidateName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || "Candidate";
  const jobTitle = candidate.jobs?.title || "Open Position";

  async function handleGenerate() {
    if (!candidate) return;
    setIsGenerating(true);
    setError("");
    setLoggedSuccess(false);

    try {
      const res = await generateCandidateOutreachAction({
        candidateId: candidate.id,
        channel,
        tone,
        customPrompt: customPrompt.trim() || undefined,
        recruiterName: activeRecruiter?.name || "Recruiter",
      });

      if (res.success && res.outreach) {
        setOutreachResult(res.outreach);
        setEditableSubject(res.outreach.subject);
        setEditableBody(res.outreach.body);
      } else {
        setError(res.error || "Failed to generate outreach message.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopySubject() {
    if (!editableSubject) return;
    navigator.clipboard.writeText(editableSubject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 2000);
  }

  function handleCopyBody() {
    if (!editableBody) return;
    navigator.clipboard.writeText(editableBody);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  }

  async function handleLogActivity() {
    if (!candidate || !editableBody) return;
    setIsLogging(true);
    try {
      const res = await logCandidateOutreachActivity({
        candidateId: candidate.id,
        channel,
        subject: editableSubject,
        body: editableBody,
        recruiterName: activeRecruiter?.name || "Recruiter",
      });

      if (res.success) {
        setLoggedSuccess(true);
        onActivityLogged?.();
      } else {
        alert(res.error || "Failed to log outreach activity.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsLogging(false);
    }
  }

  // Generate mailto link
  const mailtoUrl = candidate.email
    ? `mailto:${encodeURIComponent(candidate.email)}?subject=${encodeURIComponent(
        editableSubject
      )}&body=${encodeURIComponent(editableBody)}`
    : null;

  const linkedInUrl = candidate.linkedin_url
    ? candidate.linkedin_url.startsWith("http")
      ? candidate.linkedin_url
      : `https://${candidate.linkedin_url}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-primary text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/10 p-2">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight flex items-center gap-2">
                <span>AI Candidate Outreach</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                  {candidateName}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Target Role: <span className="text-white font-medium">{jobTitle}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Channel Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Outreach Channel
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  channel === "email"
                    ? "border-primary bg-primary/5 text-primary shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Mail className="h-4 w-4 text-rose-500" />
                <span>Cold Email</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel("linkedin")}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  channel === "linkedin"
                    ? "border-primary bg-primary/5 text-primary shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <LinkedInIcon className="h-4 w-4 text-sky-600" />
                <span>LinkedIn InMail</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel("indeed")}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  channel === "indeed"
                    ? "border-primary bg-primary/5 text-primary shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>Indeed Message</span>
              </button>
            </div>
          </div>

          {/* Tone Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Tone & Voice
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTone("professional")}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition cursor-pointer text-center ${
                  tone === "professional"
                    ? "border-secondary bg-secondary/10 text-secondary font-semibold"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Professional & Direct
              </button>

              <button
                type="button"
                onClick={() => setTone("warm")}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition cursor-pointer text-center ${
                  tone === "warm"
                    ? "border-secondary bg-secondary/10 text-secondary font-semibold"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Warm & Engaging
              </button>

              <button
                type="button"
                onClick={() => setTone("concise")}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition cursor-pointer text-center ${
                  tone === "concise"
                    ? "border-secondary bg-secondary/10 text-secondary font-semibold"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Short & Punchy
              </button>
            </div>
          </div>

          {/* Custom Focus / Advanced Instructions */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>{showAdvanced ? "Hide Custom Instructions" : "Add Custom Instructions (Optional)"}</span>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showAdvanced && (
              <div className="mt-2">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Highlight our hybrid policy, mention their previous role at Stripe..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            )}
          </div>

          {/* Generate Action Button */}
          {!outreachResult && !isGenerating && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGenerate}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-semibold text-white shadow-sm hover:bg-secondary/90 transition cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-white" />
                <span>Generate Outreach Message</span>
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-secondary" />
              <p className="text-xs text-slate-500 font-medium">
                Drafting personalized {channel} outreach for {candidateName}...
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          {/* Generated Result View */}
          {outreachResult && !isGenerating && (
            <div className="space-y-4 pt-1">
              {/* Highlights badge if present */}
              {outreachResult.keyHighlights && outreachResult.keyHighlights.length > 0 && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-secondary" />
                    Personalized Hook Highlights
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {outreachResult.keyHighlights.map((hl, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-xs text-slate-700 shadow-xs"
                      >
                        {hl}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject / Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {channel === "email" ? "Subject Line" : "Message Headline / Title"}
                  </label>
                  <button
                    type="button"
                    onClick={handleCopySubject}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    {copiedSubject ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-600 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={editableSubject}
                  onChange={(e) => setEditableSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              {/* Message Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Message Body</label>
                  <button
                    type="button"
                    onClick={handleCopyBody}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    {copiedBody ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-600 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Body</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3 text-xs leading-relaxed text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {channel === "email" && mailtoUrl && (
                    <a
                      href={mailtoUrl}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer shadow-xs"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Open Email Draft</span>
                    </a>
                  )}

                  {channel === "linkedin" && linkedInUrl && (
                    <a
                      href={linkedInUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a66c2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#084e96] transition cursor-pointer shadow-xs"
                    >
                      <LinkedInIcon className="h-3.5 w-3.5" />
                      <span>Open Profile</span>
                      <ExternalLink className="h-3 w-3 opacity-75" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyBody}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    {copiedBody ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Regenerate</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogActivity}
                    disabled={isLogging || loggedSuccess}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer shadow-xs ${
                      loggedSuccess
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-primary text-white hover:bg-primary/90"
                    }`}
                  >
                    {isLogging ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : loggedSuccess ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>{loggedSuccess ? "Logged to Timeline" : "Log Outreach"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
