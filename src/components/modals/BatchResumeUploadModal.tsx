"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileText,
  ArrowUpDown,
  Trash2,
  AlertTriangle,
  Info,
  UserCheck,
} from "lucide-react";
import { type Job } from "@/app/actions/jobs";
import {
  type Candidate,
  bulkAddCandidates,
  type BatchImportCandidateInput,
  checkBatchCandidateDuplicates,
  type CandidateDuplicateResult,
} from "@/app/actions/candidates";
import {
  APPLIED_CHANNELS,
  BATCH_IMPORT_SOURCING_CHANNELS,
  getSourceTypeForChannel,
} from "@/lib/constants";
import { parseResumeAction } from "@/app/actions/resumeParser";
import { type ParsedCandidate } from "@/lib/gemini/parser";
import { useRecruiter } from "@/context/RecruiterContext";
import { useRouter } from "next/navigation";

interface BatchResumeUploadModalProps {
  open: boolean;
  onClose: () => void;
  jobs: Job[];
  defaultJobId?: string | null;
  onCandidatesAdded?: (targetJobId: string) => void;
}

interface FileQueueItem {
  id: string;
  file: File;
  status: "waiting" | "parsing" | "done" | "error";
  error?: string;
  parsedData?: ParsedCandidate;
  selectedForImport: boolean;
}

export function BatchResumeUploadModal({
  open,
  onClose,
  jobs,
  defaultJobId,
  onCandidatesAdded,
}: BatchResumeUploadModalProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>(defaultJobId || "");

  useEffect(() => {
    if (open && defaultJobId) {
      setSelectedJobId(defaultJobId);
    }
  }, [open, defaultJobId]);

  const [sourceChannel, setSourceChannel] = useState<string>("Job Board / Career Site");
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [duplicates, setDuplicates] = useState<Record<string, CandidateDuplicateResult>>({});
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sortOrder, setSortOrder] = useState<"fitDesc" | "original">("fitDesc");
  const [importSummary, setImportSummary] = useState<{ successCount: number; errors?: string[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { activeRecruiter } = useRecruiter();
  const router = useRouter();

  if (!open) return null;

  const activeJobs = jobs.filter((j) => j.status === "Active");
  const currentJob = jobs.find((j) => j.id === (selectedJobId || defaultJobId));
  const currentSourceType = getSourceTypeForChannel(sourceChannel);

  function handleFilesAdded(files: FileList | null) {
    if (!files || files.length === 0) return;

    const validExtensions = ["pdf", "docx", "txt"];
    const newItems: FileQueueItem[] = [];

    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (validExtensions.includes(ext)) {
        newItems.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          status: "waiting",
          selectedForImport: true,
        });
      }
    });

    setQueue((prev) => [...prev, ...newItems]);
    setImportSummary(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  }

  function removeItem(id: string) {
    setQueue((prev) => prev.filter((item) => item.id !== id));
    setDuplicates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function toggleSelect(id: string) {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selectedForImport: !item.selectedForImport } : item))
    );
  }

  function toggleSelectAll(selected: boolean) {
    setQueue((prev) => prev.map((item) => ({ ...item, selectedForImport: selected })));
  }

  function selectNewOnly() {
    setQueue((prev) =>
      prev.map((item) => {
        const dup = duplicates[item.id];
        const isSameJobDup = dup?.isDuplicate && dup.sameJob;
        return {
          ...item,
          selectedForImport: !isSameJobDup,
        };
      })
    );
  }

  // Handle re-checking duplicates if target requisition changes
  async function handleTargetJobChange(newJobId: string) {
    setSelectedJobId(newJobId);
    if (!newJobId) return;

    const doneItems = queue.filter((q) => q.status === "done" && q.parsedData);
    if (doneItems.length === 0) return;

    setIsCheckingDuplicates(true);
    try {
      const checkPayload = doneItems.map((item) => ({
        id: item.id,
        firstName: item.parsedData!.firstName,
        lastName: item.parsedData!.lastName,
        email: item.parsedData!.email,
      }));
      const dupMap = await checkBatchCandidateDuplicates(checkPayload, newJobId);
      setDuplicates(dupMap);

      // Unselect any items that are duplicates in the newly selected job
      setQueue((prevQueue) =>
        prevQueue.map((item) => {
          const dup = dupMap[item.id];
          if (dup?.isDuplicate && dup.sameJob) {
            return { ...item, selectedForImport: false };
          }
          return item;
        })
      );
    } catch (err) {
      console.error("Duplicate re-check error:", err);
    } finally {
      setIsCheckingDuplicates(false);
    }
  }

  // Concurrency-controlled batch parser (Processes 2 files simultaneously)
  async function handleStartBatchParsing() {
    const targetJobId = selectedJobId || defaultJobId;
    if (!targetJobId) {
      alert("Please select a target job requisition before parsing.");
      return;
    }

    if (!currentJob?.description || currentJob.description.trim().length === 0) {
      alert("Selected job requisition is missing a job description. A valid job description is required for AI fit scoring.");
      return;
    }

    setIsProcessing(true);
    setImportSummary(null);

    const itemsToProcess = queue.filter((item) => item.status === "waiting" || item.status === "error");
    const CONCURRENCY_LIMIT = 2;
    const newlyParsedMap = new Map<string, ParsedCandidate>();

    for (let i = 0; i < itemsToProcess.length; i += CONCURRENCY_LIMIT) {
      const batch = itemsToProcess.slice(i, i + CONCURRENCY_LIMIT);

      await Promise.all(
        batch.map(async (item) => {
          // Update status to parsing
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: "parsing", error: undefined } : q))
          );

          try {
            const formData = new FormData();
            formData.append("file", item.file);
            formData.append("jobId", targetJobId);

            const result = await parseResumeAction(formData);

            if (result.success && result.data) {
              newlyParsedMap.set(item.id, result.data);
              setQueue((prev) =>
                prev.map((q) =>
                  q.id === item.id ? { ...q, status: "done", parsedData: result.data } : q
                )
              );
            } else {
              setQueue((prev) =>
                prev.map((q) =>
                  q.id === item.id
                    ? { ...q, status: "error", error: result.error || "Failed to extract candidate" }
                    : q
                )
              );
            }
          } catch (err: any) {
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, status: "error", error: err.message || "Network or extraction error" }
                  : q
              )
            );
          }
        })
      );
    }

    setIsProcessing(false);

    // Run duplicate detection on all parsed candidates
    const allDoneItems = queue
      .map((q) => {
        const newlyParsed = newlyParsedMap.get(q.id);
        if (newlyParsed) {
          return { id: q.id, parsedData: newlyParsed };
        }
        if (q.status === "done" && q.parsedData) {
          return { id: q.id, parsedData: q.parsedData };
        }
        return null;
      })
      .filter((x): x is { id: string; parsedData: ParsedCandidate } => x !== null);

    if (allDoneItems.length > 0) {
      setIsCheckingDuplicates(true);
      try {
        const checkPayload = allDoneItems.map((item) => ({
          id: item.id,
          firstName: item.parsedData.firstName,
          lastName: item.parsedData.lastName,
          email: item.parsedData.email,
        }));
        const dupMap = await checkBatchCandidateDuplicates(checkPayload, targetJobId);
        setDuplicates(dupMap);

        // Automatically uncheck candidates that already exist in this same job requisition
        setQueue((prevQueue) =>
          prevQueue.map((item) => {
            const dup = dupMap[item.id];
            if (dup?.isDuplicate && dup.sameJob) {
              return { ...item, selectedForImport: false };
            }
            return item;
          })
        );
      } catch (dupErr) {
        console.error("Batch duplicate check failed:", dupErr);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }
  }

  // Sort completed candidates
  const parsedItems = queue.filter((item) => item.status === "done" && item.parsedData);
  const sortedParsedItems = [...parsedItems].sort((a, b) => {
    if (sortOrder === "fitDesc") {
      const scoreA = a.parsedData?.fitRating ?? 0;
      const scoreB = b.parsedData?.fitRating ?? 0;
      return scoreB - scoreA;
    }
    return 0;
  });

  const selectedCount = sortedParsedItems.filter((item) => item.selectedForImport).length;

  // Duplicate statistics for review banner
  const sameJobDupCount = sortedParsedItems.filter(
    (item) => duplicates[item.id]?.isDuplicate && duplicates[item.id]?.sameJob
  ).length;
  const differentJobDupCount = sortedParsedItems.filter(
    (item) => duplicates[item.id]?.isDuplicate && !duplicates[item.id]?.sameJob
  ).length;
  const dnhCount = sortedParsedItems.filter(
    (item) => duplicates[item.id]?.existingRecord?.dnh_flag
  ).length;
  const batchInternalDupCount = sortedParsedItems.filter(
    (item) => duplicates[item.id]?.isBatchInternalDuplicate
  ).length;

  async function handleImportSelected() {
    const targetJobId = selectedJobId || defaultJobId;
    if (!targetJobId) return;

    const selectedItems = sortedParsedItems.filter((item) => item.selectedForImport && item.parsedData);

    if (selectedItems.length === 0) {
      alert("No candidates selected for import.");
      return;
    }

    // Safety checks for duplicates and DNH flags
    const hasDnhSelected = selectedItems.some(
      (item) => duplicates[item.id]?.existingRecord?.dnh_flag
    );
    if (hasDnhSelected) {
      const confirmDnh = window.confirm(
        "One or more selected candidates are flagged as Do Not Hire (DNH). Are you sure you want to import them?"
      );
      if (!confirmDnh) return;
    }

    const hasSameJobSelected = selectedItems.some(
      (item) => duplicates[item.id]?.isDuplicate && duplicates[item.id]?.sameJob
    );
    if (hasSameJobSelected) {
      const confirmDup = window.confirm(
        "One or more selected candidates already exist in this job opening. Do you still want to proceed and create additional application records?"
      );
      if (!confirmDup) return;
    }

    const today = new Date().toISOString().split("T")[0];

    const candidatesToImport: BatchImportCandidateInput[] = selectedItems.map((item) => {
      const data = item.parsedData!;
      return {
        first_name: data.firstName || "Candidate",
        last_name: data.lastName || "Imported",
        email: data.email,
        phone: data.phone,
        address: data.address,
        primary_skills: data.primarySkills?.join(", "),
        years_of_experience: data.yearsOfExperience,
        ai_summary: data.fitSummary,
        fit_rating: data.fitRating,
        sub_scores: data.subScores || null,
        resume_text: data.rawResumeText || null,
        work_experience: data.work_experience,
        job_id: targetJobId,
        source_channel: sourceChannel,
        source_type: currentSourceType,
        date_applied: today,
        date_sourced: currentSourceType === "outbound" ? today : undefined,
        author_name: activeRecruiter?.name || "Recruiter",
      };
    });

    setIsImporting(true);
    try {
      const res = await bulkAddCandidates(candidatesToImport);
      setImportSummary({ successCount: res.count, errors: res.errors });
      if (res.success) {
        onCandidatesAdded?.(targetJobId);
        router.refresh();
      }
    } catch (err: any) {
      alert("Failed to import candidates: " + err.message);
    } finally {
      setIsImporting(false);
    }
  }

  function handleReset() {
    setQueue([]);
    setDuplicates({});
    setImportSummary(null);
    setIsProcessing(false);
    setIsCheckingDuplicates(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-primary text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-white/10 p-2">
              <Sparkles className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight flex items-center gap-2">
                <span>Batch Resume Ingestion</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                  Gemini Flash Pipeline
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Upload up to 15 resumes at once. AI extracts profiles, runs duplicate detection, and auto-ranks by fit score.
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
          {/* Configuration Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Target Requisition <span className="text-danger">*</span>
              </label>
              <select
                value={selectedJobId || defaultJobId || ""}
                onChange={(e) => handleTargetJobChange(e.target.value)}
                disabled={isProcessing || isImporting}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-secondary/30"
              >
                <option value="" disabled>
                  Select Job Requisition
                </option>
                {activeJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.department || "General"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Sourcing Channel
                </label>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    currentSourceType === "inbound"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {currentSourceType === "inbound" ? "Applied (Inbound)" : "Sourced (Outbound)"}
                </span>
              </div>
              <select
                value={sourceChannel}
                onChange={(e) => setSourceChannel(e.target.value)}
                disabled={isProcessing || isImporting}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-secondary/30"
              >
                <optgroup label="Applied Channels">
                  {APPLIED_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Sourced Channels">
                  {BATCH_IMPORT_SOURCING_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-secondary bg-secondary/10"
                : "border-slate-300 bg-slate-50 hover:bg-slate-100/80"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={(e) => handleFilesAdded(e.target.files)}
              className="hidden"
            />
            <div className="rounded-full bg-white p-3 shadow-xs border border-slate-200 text-secondary mb-2">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Drag and drop multiple resumes here, or <span className="text-secondary underline">browse files</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Supports PDF, DOCX, and TXT (up to 15 files per batch)</p>
          </div>

          {/* Ingestion Queue & Review */}
          {queue.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-primary">
                    Resume Batch ({queue.length} {queue.length === 1 ? "file" : "files"})
                  </h3>
                  {parsedItems.length > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      {parsedItems.length} Parsed
                    </span>
                  )}
                  {isCheckingDuplicates && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking duplicates...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {parsedItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSortOrder((prev) => (prev === "fitDesc" ? "original" : "fitDesc"))}
                      className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:text-secondary/80 transition cursor-pointer"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      {sortOrder === "fitDesc" ? "Ranked: Highest Fit" : "File Order"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isProcessing || isImporting}
                    className="text-xs text-slate-500 hover:text-danger transition cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Duplicate Detection Alert Banner */}
              {parsedItems.length > 0 && (sameJobDupCount > 0 || differentJobDupCount > 0 || dnhCount > 0 || batchInternalDupCount > 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 font-semibold text-amber-900">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Duplicate Check Findings:</span>
                      {sameJobDupCount > 0 && (
                        <span className="rounded-full bg-amber-200/90 px-2 py-0.5 text-[11px] font-bold text-amber-950">
                          {sameJobDupCount} duplicate{sameJobDupCount > 1 ? "s" : ""} in this job (unselected by default)
                        </span>
                      )}
                      {differentJobDupCount > 0 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-900">
                          {differentJobDupCount} returning applicant{differentJobDupCount > 1 ? "s" : ""} from other pipelines
                        </span>
                      )}
                      {dnhCount > 0 && (
                        <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-950">
                          {dnhCount} Do Not Hire (DNH)
                        </span>
                      )}
                      {batchInternalDupCount > 0 && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-900">
                          {batchInternalDupCount} internal batch duplicate{batchInternalDupCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {sameJobDupCount > 0 && (
                      <button
                        type="button"
                        onClick={selectNewOnly}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-200/80 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-300 transition cursor-pointer"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Select New Candidates Only
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800/90">
                    Existing candidates in this job opening are unselected by default to prevent accidental duplicates. Review the badges below if you choose to import them anyway.
                  </p>
                </div>
              )}

              {/* Staging / Results Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                <div className="max-h-[340px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-slate-700 font-semibold border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={sortedParsedItems.length > 0 && selectedCount === sortedParsedItems.length}
                            onChange={(e) => toggleSelectAll(e.target.checked)}
                            className="rounded text-secondary focus:ring-secondary/30 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">File / Candidate</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">AI Fit Rating</th>
                        <th className="py-2.5 px-3">3-Pillar Breakdown</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(parsedItems.length > 0 ? sortedParsedItems : queue).map((item, idx) => {
                        const parsed = item.parsedData;
                        const dup = duplicates[item.id];

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3">
                              {item.status === "done" && (
                                <input
                                  type="checkbox"
                                  checked={item.selectedForImport}
                                  onChange={() => toggleSelect(item.id)}
                                  className="rounded text-secondary focus:ring-secondary/30 cursor-pointer"
                                />
                              )}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-900">
                              {parsed ? (
                                <div className="space-y-1">
                                  <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                    <span>{parsed.firstName} {parsed.lastName}</span>
                                    {sortOrder === "fitDesc" && (
                                      <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                                    )}
                                  </div>

                                  {/* Duplicate and Cross-Pipeline Badges */}
                                  {dup?.isDuplicate && dup.sameJob && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span
                                        className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300"
                                        title={`Already exists in this requisition at the ${dup.existingRecord?.pipeline_stage?.replace(/_/g, " ") || "unknown"} stage`}
                                      >
                                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                                        Duplicate in this job ({dup.existingRecord?.pipeline_stage?.replace(/_/g, " ") || "Pipeline"})
                                      </span>
                                      {dup.existingRecord?.dnh_flag && (
                                        <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-300">
                                          🚫 DNH Flagged
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {dup?.isDuplicate && !dup.sameJob && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span
                                        className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-900 border border-blue-200"
                                        title={`Previously applied for ${dup.existingRecord?.job_title || "another role"} (${dup.existingRecord?.pipeline_stage?.replace(/_/g, " ")})`}
                                      >
                                        <Info className="h-3 w-3 text-blue-600" />
                                        Returning Candidate: {dup.existingRecord?.job_title ? `${dup.existingRecord.job_title} · ` : ""}{dup.existingRecord?.pipeline_stage?.replace(/_/g, " ") || "Other Pipeline"}
                                      </span>
                                      {dup.existingRecord?.dnh_flag && (
                                        <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-300">
                                          🚫 DNH Flagged
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {dup?.isBatchInternalDuplicate && (
                                    <div className="flex items-center gap-1">
                                      <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-900 border border-purple-200">
                                        ⚠️ Duplicate file in this batch
                                      </span>
                                    </div>
                                  )}

                                  <div className="text-[11px] text-slate-500 line-clamp-1 max-w-xs" title={parsed.fitSummary}>
                                    {parsed.fitSummary}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-slate-700">
                                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="truncate max-w-xs">{item.file.name}</span>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 text-slate-600">
                              {parsed ? (
                                <div>
                                  <div>{parsed.email || "-"}</div>
                                  <div className="text-slate-400">{parsed.phone || ""}</div>
                                </div>
                              ) : (
                                <span className="text-slate-400">{(item.file.size / 1024).toFixed(0)} KB</span>
                              )}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              {parsed ? (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold ${
                                      parsed.fitRating >= 4
                                        ? "bg-emerald-100 text-emerald-800"
                                        : parsed.fitRating === 3
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-rose-100 text-rose-800"
                                    }`}
                                  >
                                    ★ {parsed.fitRating}/5
                                  </span>
                                  {parsed.yearsOfExperience ? (
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      {parsed.yearsOfExperience}y exp
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              {parsed?.subScores ? (
                                <div className="flex gap-1.5 text-[10px]">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600" title="Functional Experience">
                                    Exp: <strong>{parsed.subScores.functionalExperience}</strong>
                                  </span>
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600" title="Required Credentials">
                                    Creds: <strong>{parsed.subScores.requiredCredentials}</strong>
                                  </span>
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600" title="Role Skills">
                                    Skills: <strong>{parsed.subScores.roleSpecificSkills}</strong>
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              {item.status === "waiting" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                                  Waiting
                                </span>
                              )}
                              {item.status === "parsing" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Parsing
                                </span>
                              )}
                              {item.status === "done" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-medium">
                                  <CheckCircle2 className="h-3 w-3" /> Ready
                                </span>
                              )}
                              {item.status === "error" && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 font-medium"
                                  title={item.error}
                                >
                                  <AlertCircle className="h-3 w-3" /> Failed
                                </span>
                              )}
                              {!isProcessing && !isImporting && (
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.id)}
                                  className="ml-2 text-slate-400 hover:text-danger transition cursor-pointer"
                                  title="Remove from batch"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import Result Notification */}
          {importSummary && (
            <div
              className={`rounded-xl p-4 text-xs font-medium ${
                importSummary.successCount > 0
                  ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                  : "bg-rose-50 text-rose-900 border border-rose-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>
                  Successfully imported <strong>{importSummary.successCount} candidates</strong> into the New Application stage!
                </span>
              </div>
              {importSummary.errors && importSummary.errors.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-rose-700 space-y-0.5">
                  {importSummary.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {parsedItems.length > 0 ? (
              <span>
                <strong>{selectedCount}</strong> of {parsedItems.length} parsed candidates selected
                {sameJobDupCount > 0 && (
                  <span className="ml-1 text-amber-600">({sameJobDupCount} same-job duplicate unselected)</span>
                )}
              </span>
            ) : (
              <span>Select files and start AI parsing</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing || isImporting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              {importSummary?.successCount ? "Close" : "Cancel"}
            </button>

            {parsedItems.length === 0 ? (
              <button
                type="button"
                onClick={handleStartBatchParsing}
                disabled={queue.length === 0 || isProcessing}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                    <span>Parsing Batch ({queue.filter((q) => q.status === "done").length}/{queue.length})...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-secondary" />
                    <span>Parse {queue.length} Resumes</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleImportSelected}
                disabled={selectedCount === 0 || isImporting || isCheckingDuplicates}
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2 text-sm font-semibold text-white hover:bg-secondary/90 transition disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importing to Pipeline...</span>
                  </>
                ) : isCheckingDuplicates ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking Duplicates...</span>
                  </>
                ) : (
                  <span>Import {selectedCount} Candidates</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
