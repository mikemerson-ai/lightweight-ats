"use client";

import { useState, useRef } from "react";
import { X, Copy, Check, Sparkles, Upload, Loader2, AlertCircle, ShieldAlert, CheckCircle2, FileText } from "lucide-react";
import { type Candidate } from "@/app/actions/candidates";
import { generateCandidateScorecard } from "@/app/actions/generateScorecard";

interface ScorecardViewerModalProps {
  open: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  existingMarkdown?: string | null;
  onScorecardGenerated?: (markdown: string) => void;
}

export function ScorecardViewerModal({
  open,
  onClose,
  candidate,
  existingMarkdown,
  onScorecardGenerated,
}: ScorecardViewerModalProps) {
  const [markdown, setMarkdown] = useState<string>(existingMarkdown || "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [prevCandidateId, setPrevCandidateId] = useState<string | undefined>(candidate?.id);

  // Sync markdown if candidate changes or existingMarkdown changes
  if (candidate?.id !== prevCandidateId) {
    setPrevCandidateId(candidate?.id);
    setMarkdown(existingMarkdown || "");
    setError("");
    setShowUpload(false);
    setSelectedFile(null);
    setViewMode("rendered");
  } else if (existingMarkdown && existingMarkdown !== markdown && !loading) {
    setMarkdown(existingMarkdown);
  }

  if (!open || !candidate) {
    return null;
  }

  // Parse key metrics from markdown
  const recMatch = markdown.match(/Match Recommendation:\s*\*?\*?\s*(STRONG PURSUE|CONDITIONAL SCREEN|DO NOT ADVANCE)/i);
  const recommendation = recMatch ? recMatch[1].toUpperCase() : null;

  const scoreMatch = markdown.match(/Overall Fit Score:\s*\*?\*?\s*(\d{1,3})/i);
  const fitScore = scoreMatch ? scoreMatch[1] : null;

  async function handleGenerate(fileToUse?: File) {
    if (!candidate) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("candidateId", candidate.id);
      if (fileToUse) {
        formData.append("file", fileToUse);
      }

      const result = await generateCandidateScorecard(formData);
      if (result.success && result.scorecard) {
        setMarkdown(result.scorecard.markdown);
        setShowUpload(false);
        setSelectedFile(null);
        if (onScorecardGenerated) {
          onScorecardGenerated(result.scorecard.markdown);
        }
      } else {
        setError(result.error || "Failed to generate evaluation scorecard.");
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function copyInterviewQuestions() {
    // Extract Section 4 interview questions
    const probesSection = markdown.split(/###\s*4\.\s*Recruiter Interview Probes/i)[1];
    const textToCopy = probesSection ? probesSection.trim() : markdown;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Helper to render markdown content cleanly
  function renderMarkdownBlocks(content: string) {
    if (!content) return null;

    const sections = content.split(/(?=###?\s+\d+\.)/g);

    return (
      <div className="space-y-6 text-slate-800">
        {sections.map((section, idx) => {
          const trimmed = section.trim();

          // Skip empty blocks or blocks that are just markdown artifacts like '#'
          if (!trimmed || trimmed.replace(/#+/g, "").trim() === "") return null;

          // Section 0: Candidate Screening Summary (skip because it's in the top banner)
          if (trimmed.includes("Candidate Screening Summary")) {
            return null;
          }

          // Section 1: Hard Gates Table
          if (trimmed.includes("Hard Gate Requirements Check") || trimmed.includes("| :---")) {
            const lines = trimmed.split("\n");
            const tableLines = lines.filter((l) => l.trim().startsWith("|"));

            // Parse markdown table rows
            const rows = tableLines
              .map((l) =>
                l
                  .split("|")
                  .map((c) => c.trim())
                  .filter(Boolean)
              )
              .filter((cols) => cols.length >= 3 && !cols[0].includes("---") && !cols[0].includes("Non-Negotiable"));

            return (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="flex items-center gap-2 text-base font-semibold text-primary">
                  <ShieldAlert className="h-5 w-5 text-secondary" />
                  1. Hard Gate Requirements Check
                </h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-2.5 px-3">Non-Negotiable Requirement</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Exact Evidence / Resume Snippet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((cols, rIdx) => {
                        const status = cols[1] || "";
                        const isMatch = status.toLowerCase().includes("strong") || status.toLowerCase().includes("match");
                        const isPartial = status.toLowerCase().includes("partial");
                        const isMissing = status.toLowerCase().includes("missing") || status.toLowerCase().includes("not evident");

                        let statusBadge = (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {status}
                          </span>
                        );
                        if (isMatch && !isPartial) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" /> Strong Match
                            </span>
                          );
                        } else if (isPartial) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                              <AlertCircle className="h-3 w-3" /> Partial Match
                            </span>
                          );
                        } else if (isMissing) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                              <X className="h-3 w-3" /> Missing
                            </span>
                          );
                        }

                        return (
                          <tr key={rIdx} className="hover:bg-slate-50/50">
                            <td className="py-3 px-3 font-medium text-slate-900">{cols[0]}</td>
                            <td className="py-3 px-3 whitespace-nowrap">{statusBadge}</td>
                            <td className="py-3 px-3 text-xs italic text-slate-600 font-mono bg-slate-50/50 rounded">
                              {cols[2].replace(/\*\*/g, "").replace(/\*/g, "")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          // Section 2: Experience & Impact Analysis
          if (trimmed.includes("Experience & Impact Analysis")) {
            const bullets = trimmed
              .split("\n")
              .filter((l) => l.trim().startsWith("-"))
              .map((l) => l.replace(/^-\s*/, ""));

            return (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="text-base font-semibold text-primary">2. Experience & Impact Analysis</h3>
                <div className="mt-4 space-y-3">
                  {bullets.map((b, bIdx) => {
                    const [title, ...descParts] = b.split(":");
                    const desc = descParts.join(":");
                    return (
                      <div key={bIdx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                          {title.replace(/\*\*/g, "").replace(/\*/g, "").trim()}
                        </span>
                        <p className="text-sm text-slate-700 leading-relaxed">{desc.replace(/\*\*/g, "").replace(/\*/g, "").trim()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Section 3: Red Flags & Knowledge Gaps
          if (trimmed.includes("Red Flags & Knowledge Gaps")) {
            const bullets = trimmed
              .split("\n")
              .filter((l) => l.trim().startsWith("-"))
              .map((l) => l.replace(/^-\s*/, ""));

            return (
              <div key={idx} className="rounded-xl border border-amber-200 bg-amber-50/30 p-5 shadow-xs">
                <h3 className="flex items-center gap-2 text-base font-semibold text-amber-900">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  3. Red Flags & Knowledge Gaps
                </h3>
                <ul className="mt-3 space-y-2">
                  {bullets.map((b, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-2 text-sm text-slate-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                      <span>{b.replace(/\*\*/g, "").replace(/\*/g, "")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }

          // Section 4: Recruiter Interview Probes
          if (trimmed.includes("Recruiter Interview Probes")) {
            const probeLines = trimmed
              .split("\n")
              .filter((l) => /^\d+\./.test(l.trim()))
              .map((l) => l.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").replace(/\*/g, ""));

            return (
              <div key={idx} className="rounded-xl border border-secondary/20 bg-secondary/5 p-5 shadow-xs">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-primary">
                    <Sparkles className="h-5 w-5 text-secondary" />
                    4. Recruiter Interview Probes
                  </h3>
                  <button
                    type="button"
                    onClick={copyInterviewQuestions}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition shadow-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        Copy Questions
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {probeLines.map((p, pIdx) => (
                    <div key={pIdx} className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
                      <p className="text-sm font-medium text-slate-800 leading-relaxed">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // Fallback rendering
          return (
            <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
              <pre className="whitespace-pre-wrap text-sm font-sans text-slate-700">{trimmed.replace(/\*\*/g, "").replace(/\*/g, "")}</pre>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-slate-50 shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-primary">AI Evaluation Scorecard</h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  Pass 2 Deep-Reasoning
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {candidate.first_name} {candidate.last_name} • {candidate.jobs?.title || "Target Role"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {markdown && (
              <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setViewMode("rendered")}
                  className={`rounded-md px-2.5 py-1 ${viewMode === "rendered" ? "bg-white text-primary shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Scorecard View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("raw")}
                  className={`rounded-md px-2.5 py-1 ${viewMode === "raw" ? "bg-white text-primary shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Raw Markdown
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Evaluation Error</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Top Recommendation Banner (if generated) */}
          {recommendation && fitScore && (
            <div
              className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5 ${
                recommendation === "STRONG PURSUE"
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  : recommendation === "CONDITIONAL SCREEN"
                  ? "border-amber-200 bg-amber-50/80 text-amber-900"
                  : "border-rose-200 bg-rose-50/80 text-rose-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold text-white shadow-xs ${
                    recommendation === "STRONG PURSUE"
                      ? "bg-emerald-600"
                      : recommendation === "CONDITIONAL SCREEN"
                      ? "bg-amber-600"
                      : "bg-rose-600"
                  }`}
                >
                  {recommendation === "STRONG PURSUE" ? (
                    <Check className="h-6 w-6" />
                  ) : recommendation === "CONDITIONAL SCREEN" ? (
                    <AlertCircle className="h-6 w-6" />
                  ) : (
                    <X className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-80 block">
                    Screening Recommendation
                  </span>
                  <h3 className="text-xl font-extrabold tracking-tight">{recommendation}</h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-80 block">
                    Overall Fit Score
                  </span>
                  <div className="text-2xl font-black">{fitScore} / 100</div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-secondary mb-4" />
              <h4 className="text-base font-semibold text-primary">Evaluating Candidate with Gemini...</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Deconstructing job hard gates, analyzing quantified impact, checking red flags, and drafting recruiter interview probes.
              </p>
            </div>
          ) : markdown ? (
            viewMode === "rendered" ? (
              renderMarkdownBlocks(markdown)
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap">
                {markdown}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white p-8">
              <div className="h-14 w-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-primary">No Scorecard Generated Yet</h3>
              <p className="text-sm text-slate-500 max-w-md mt-1.5">
                Generate an evidence-backed scorecard evaluated against <strong>{candidate.jobs?.title || "the target role"}</strong>.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 text-secondary" />
                  Generate Scorecard Now
                </button>

                <button
                  type="button"
                  onClick={() => setShowUpload(!showUpload)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <Upload className="h-4 w-4 text-slate-500" />
                  Attach / Update Resume First
                </button>
              </div>
            </div>
          )}

          {/* Resume Upload Drawer / Accordion */}
          {showUpload && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <FileText className="h-4 w-4 text-secondary" />
                  Upload Resume to Evaluate
                </h4>
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-200 hover:border-secondary rounded-xl p-6 text-center transition bg-slate-50/50"
              >
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  {selectedFile ? selectedFile.name : "Click to select PDF or DOCX resume"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Supports PDF and Word formats up to 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                    }
                  }}
                />
              </div>

              {selectedFile && (
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerate(selectedFile)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Evaluate Uploaded Resume
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            {markdown && (
              <button
                type="button"
                onClick={() => setShowUpload(!showUpload)}
                className="text-xs font-medium text-slate-600 hover:text-primary transition flex items-center gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Re-evaluate with New Document
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {markdown && (
              <button
                type="button"
                onClick={copyInterviewQuestions}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                {copied ? "Copied Probes!" : "Copy Interview Probes"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
