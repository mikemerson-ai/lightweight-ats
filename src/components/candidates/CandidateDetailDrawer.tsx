"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Mail, Phone, Star, X, ExternalLink, AlertTriangle, ChevronDown, ChevronUp, Link as LinkIcon, MapPin, Edit, RefreshCw, FileText, Upload } from "lucide-react";
import {
  type Candidate,
  getCandidateActivity,
  deleteCandidate,
  setCandidateDNHStatus,
  addCandidateNote,
  updateCandidateProfile,
  reEvaluateCandidateFit,
  uploadCandidateResume,
  getCandidateById,
  type ActivityLogEntry,
} from "@/app/actions/candidates";
import {
  addDocumentRequirement,
  getCandidateDocuments,
  updateDocumentStatus,
  updateDocumentRecord,
} from "@/app/actions/documents";
import {
  type CandidateDocument,
  type DocumentStatus,
  STANDARD_COMPLIANCE_DOCUMENTS,
} from "@/types/documents";
import { useRecruiter } from "@/context/RecruiterContext";
import {
  getSourceBadgeVariant,
  sourceBadgeLabel,
  getCandidateOriginDate,
  formatCandidateDate,
} from "@/components/kanban/CandidateCard";
import { getEvaluationsByCandidate } from "@/app/actions/evaluations";
import type { Evaluation } from "@/types/evaluations";
import { EvaluationModal } from "@/components/modals/EvaluationModal";
import { ScorecardViewerModal } from "@/components/modals/ScorecardViewerModal";
import { AiOutreachModal } from "@/components/modals/AiOutreachModal";
import { Trash2, Sparkles } from "lucide-react";

const STAGE_TITLES: Record<string, string> = {
  new_application: "New Application",
  screening: "Screening",
  interview: "Interview",
  completing_requirements: "Completing Requirements",
  offer: "Offer",
  background_checks: "Background Checks",
  hired: "Hired",
  disqualified: "Rejected",
};

const BADGE_VARIANT_STYLES: Record<string, string> = {
  inbound:
    "rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white",
  sourced: "rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white",
  referral:
    "rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white",
};

const RECOMMENDATION_STYLE: Record<string, string> = {
  "Strong Hire":
    "bg-success text-success-foreground",
  Hire: "bg-secondary text-white",
  Hold: "bg-warning text-warning-foreground",
  Reject: "bg-danger text-danger-foreground",
};

function recommendationStyle(recommendation: string): string {
  return RECOMMENDATION_STYLE[recommendation] ?? "bg-primary text-white";
}

const DOCUMENT_STATUS_STYLES: Record<DocumentStatus, string> = {
  Pending: "rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white",
  Submitted: "rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white",
  Verified: "rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white",
  Expired: "rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white",
  "N/A": "rounded-full bg-slate-500 px-2 py-0.5 text-xs font-semibold text-white",
};

const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  Pending: "Pending",
  Submitted: "Submitted",
  Verified: "Verified",
  Expired: "Expired",
  "N/A": "N/A",
};

function DocumentCard({ doc, onRefresh, activeRecruiterName }: { doc: CandidateDocument, onRefresh: () => void, activeRecruiterName: string | undefined }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [status, setStatus] = useState<DocumentStatus>(doc.status);
  const [sharepointUrl, setSharepointUrl] = useState(doc.sharepoint_url || "");
  const [dateIssued, setDateIssued] = useState(doc.date_issued || "");
  const [dateExpired, setDateExpired] = useState(doc.date_expired || "");

  const isExpiringSoon = () => {
    if (!doc.date_expired) return false;
    const expiry = new Date(doc.date_expired);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= 0;
  };

  const isExpired = () => {
    if (!doc.date_expired) return false;
    return new Date(doc.date_expired) < new Date();
  };

  const handleSave = async () => {
    if (doc.requires_expiration && (status === "Submitted" || status === "Verified") && !dateExpired) {
      alert("An expiration date is required for this document before it can be marked as Submitted or Verified.");
      return;
    }

    setIsSaving(true);
    try {
      await updateDocumentRecord(doc.id, {
        status,
        sharepointUrl: sharepointUrl || undefined,
        dateIssued: dateIssued || undefined,
        dateExpired: dateExpired || undefined,
        verifiedBy: status === "Verified" && doc.status !== "Verified" ? (activeRecruiterName || "Recruiter") : undefined,
      });
      setIsExpanded(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to update document");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-slate-50">
        <div className="flex flex-col flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 truncate">
              {doc.document_name}
            </span>
            {doc.sharepoint_url && (
              <a href={doc.sharepoint_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 shrink-0" title="View in SharePoint">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {doc.category && (
            <span className="text-xs text-slate-500">
              {doc.category}
            </span>
          )}
          {doc.date_expired && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs text-slate-500">
                Expires: {new Date(doc.date_expired).toLocaleDateString()}
              </span>
              {(isExpired() || isExpiringSoon()) && (
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isExpired() ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                  <AlertTriangle className="h-3 w-3" />
                  {isExpired() ? 'Expired' : 'Expiring Soon'}
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <span className={`${DOCUMENT_STATUS_STYLES[doc.status]}`}>
            {DOCUMENT_STATUS_LABELS[doc.status]}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-md transition-colors"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-3 border-t border-slate-200 space-y-3 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DocumentStatus)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900"
              >
                {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">SharePoint URL</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400">
                  <LinkIcon className="h-3.5 w-3.5" />
                </div>
                <input
                  type="url"
                  value={sharepointUrl}
                  onChange={(e) => setSharepointUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-md border border-slate-300 pl-7 pr-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Date Issued</label>
              <input
                type="date"
                value={dateIssued}
                onChange={(e) => setDateIssued(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Expiration Date
                {doc.requires_expiration && <span className="text-rose-500 ml-1">*</span>}
              </label>
              <input
                type="date"
                value={dateExpired}
                onChange={(e) => setDateExpired(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Details"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CandidateDetailDrawerProps {
  candidate: Candidate | null;
  onClose: () => void;
  onStageChange?: (candidate: Candidate, stage: string) => void;
  onCandidateUpdated?: (candidate: Candidate) => void;
}

export function CandidateDetailDrawer({
  candidate,
  onClose,
  onStageChange,
  onCandidateUpdated,
}: CandidateDetailDrawerProps) {
  const [localCandidate, setLocalCandidate] = useState<Candidate | null>(candidate);
  const [isReEvaluating, setIsReEvaluating] = useState(false);

  useEffect(() => {
    setLocalCandidate(candidate);
  }, [candidate]);

  const activeCandidate = localCandidate || candidate;

  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [activeTab, setActiveTab] = useState<
    "compliance" | "activity" | "evaluations" | "experience"
  >("activity");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [newDocName, setNewDocName] = useState(STANDARD_COMPLIANCE_DOCUMENTS[0].name);
  const [newDocCategory, setNewDocCategory] = useState(STANDARD_COMPLIANCE_DOCUMENTS[0].category);
  const [newDocRequiresExpiration, setNewDocRequiresExpiration] = useState(STANDARD_COMPLIANCE_DOCUMENTS[0].requiresExpiration);
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  
  const [showDNHModal, setShowDNHModal] = useState(false);
  const [dnhReason, setDnhReason] = useState("");
  const [dnhDate, setDnhDate] = useState("");
  const [dnhRecruiter, setDnhRecruiter] = useState("");
  const [isSavingDnh, setIsSavingDnh] = useState(false);
  
  const [noteType, setNoteType] = useState("General Note");
  const [noteText, setNoteText] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    primary_skills: "",
    years_of_experience: "" as string | number,
    date_applied: "",
    date_sourced: "",
    linkedin_url: "",
  });

  const { activeRecruiter } = useRecruiter();

  async function handleSaveProfile() {
    if (!candidate) return;
    setIsSavingProfile(true);
    try {
      await updateCandidateProfile(candidate.id, {
        ...editForm,
        years_of_experience: editForm.years_of_experience ? Number(editForm.years_of_experience) : null,
        date_applied: editForm.date_applied || undefined,
        date_sourced: editForm.date_sourced || undefined,
        linkedin_url: editForm.linkedin_url || undefined,
      });
      setShowEditModal(false);
      window.location.reload();
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleResumeUpload(file: File) {
    if (!activeCandidate) return;
    setIsUploadingResume(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("authorName", activeRecruiter?.name || "Recruiter");
      const res = await uploadCandidateResume(activeCandidate.id, formData);
      if (res.success && res.candidate) {
        setLocalCandidate(res.candidate);
        onCandidateUpdated?.(res.candidate);
        const updatedActivity = await getCandidateActivity(activeCandidate.id);
        setActivity(updatedActivity);
        alert("Resume uploaded successfully!");
      } else {
        alert(res.error || "Failed to upload resume.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to upload resume.");
    } finally {
      setIsUploadingResume(false);
    }
  }

  async function handleAddNote() {
    if (!candidate || !noteText.trim()) return;
    setIsSubmittingNote(true);
    try {
      await addCandidateNote(
        candidate.id,
        noteText.trim(),
        activeRecruiter?.name || "Recruiter",
        noteType
      );
      setNoteText("");
      setNoteType("General Note");
      const updatedActivity = await getCandidateActivity(candidate.id);
      setActivity(updatedActivity);
    } catch (err: any) {
      alert("Failed to add note: " + err.message);
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function refreshDocuments() {
    if (!candidate) return;
    getCandidateDocuments(candidate.id)
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }

  async function handleDocumentStatusChange(
    doc: CandidateDocument,
    status: DocumentStatus,
    verifiedBy?: string,
  ) {
    try {
      await updateDocumentStatus(doc.id, status, verifiedBy);
      await refreshDocuments();
    } catch (err) {
      console.error("Failed to update document status", err);
      alert("Failed to update document status");
    }
  }

  async function handleMarkVerified(doc: CandidateDocument) {
    await handleDocumentStatusChange(
      doc,
      "Verified",
      activeRecruiter?.name || "Recruiter",
    );
  }

  async function handleAddDocumentRequirement() {
    if (!candidate || !newDocName.trim()) return;
    setIsAddingDoc(true);
    try {
      await addDocumentRequirement(
        candidate.id,
        newDocName.trim(),
        newDocCategory,
        newDocRequiresExpiration,
      );
      setNewDocName(STANDARD_COMPLIANCE_DOCUMENTS[0].name);
      setNewDocCategory(STANDARD_COMPLIANCE_DOCUMENTS[0].category);
      setNewDocRequiresExpiration(STANDARD_COMPLIANCE_DOCUMENTS[0].requiresExpiration);
      await refreshDocuments();
    } catch (err) {
      console.error("Failed to add document requirement", err);
      alert("Failed to add document requirement");
    } finally {
      setIsAddingDoc(false);
    }
  }

  async function handleDelete() {
    if (!candidate) return;
    setIsDeleting(true);
    try {
      await deleteCandidate(candidate.id);
      onClose();
      // Need to trigger a board refresh, typically handled by parent component re-fetching or optimistic updates. 
      // Refreshing the page is the simplest fallback.
      window.location.reload();
    } catch (err) {
      console.error("Failed to delete candidate", err);
      alert("Failed to delete candidate");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  useEffect(() => {
    if (!candidate) {
      setActivity([]);
      setDocuments([]);
      setEvaluations([]);
      return;
    }
    getCandidateActivity(candidate.id)
      .then(setActivity)
      .catch(() => setActivity([]));
    refreshDocuments();
    getEvaluationsByCandidate(candidate.id)
      .then(setEvaluations)
      .catch(() => setEvaluations([]));
    
    
    // Reset state on candidate change
    setShowDeleteConfirm(false);
    setShowEvaluationModal(false);
    setShowDNHModal(false);
    setShowEditModal(false);
    
    if (candidate) {
      setDnhDate(candidate.dnh_date || new Date().toISOString().split("T")[0]);
      setDnhRecruiter(candidate.dnh_recruiter || activeRecruiter?.name || "");
      setDnhReason(candidate.dnh_reason || "");
      setEditForm({
        first_name: candidate.first_name || "",
        last_name: candidate.last_name || "",
        email: candidate.email || "",
        phone: candidate.phone || "",
        address: candidate.address || "",
        primary_skills: candidate.primary_skills || "",
        years_of_experience: candidate.years_of_experience || "",
        date_applied: candidate.date_applied ? candidate.date_applied.split("T")[0] : "",
        date_sourced: candidate.date_sourced ? candidate.date_sourced.split("T")[0] : "",
        linkedin_url: candidate.linkedin_url || "",
      });
    }
  }, [candidate, activeRecruiter]);

  async function handleSetDNH() {
    if (!candidate || !dnhDate || !dnhRecruiter || !dnhReason) {
      alert("Please fill in all required fields.");
      return;
    }
    setIsSavingDnh(true);
    try {
      await setCandidateDNHStatus(candidate.id, {
        dnh_flag: true,
        dnh_date: dnhDate,
        dnh_recruiter: dnhRecruiter,
        dnh_reason: dnhReason,
      });
      setShowDNHModal(false);
      window.location.reload();
    } catch (err: any) {
      alert("Failed to flag candidate.");
    } finally {
      setIsSavingDnh(false);
    }
  }

  async function handleRemoveDNH() {
    if (!candidate) return;
    if (!confirm("Are you sure you want to remove the Do-Not-Hire flag?")) return;
    setIsSavingDnh(true);
    try {
      await setCandidateDNHStatus(candidate.id, {
        dnh_flag: false,
      });
      window.location.reload();
    } catch (err: any) {
      alert("Failed to remove flag.");
    } finally {
      setIsSavingDnh(false);
    }
  }

  async function handleReEvaluateFit() {
    if (!activeCandidate?.id) return;
    setIsReEvaluating(true);
    try {
      const res = await reEvaluateCandidateFit(activeCandidate.id, activeRecruiter?.name);
      if (res.success && res.candidate) {
        setLocalCandidate(res.candidate);
        onCandidateUpdated?.(res.candidate);
        const updatedActivity = await getCandidateActivity(activeCandidate.id);
        setActivity(updatedActivity);
      } else {
        alert(res.error || "Failed to re-evaluate candidate fit.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An unexpected error occurred during re-evaluation.");
    } finally {
      setIsReEvaluating(false);
    }
  }

  const skills =
    activeCandidate?.primary_skills
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const originInfo = activeCandidate ? getCandidateOriginDate(activeCandidate) : { label: "Applied", date: "" };

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
        <aside className="absolute right-0 top-0 h-full w-full max-w-2xl translate-x-0 bg-white shadow-lg flex flex-col">
          <div className="flex flex-col gap-0 bg-primary px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{candidate.first_name} {candidate.last_name}</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Edit candidate profile"
                  className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                  onClick={() => {
                    if (activeCandidate) {
                      setEditForm({
                        first_name: activeCandidate.first_name || "",
                        last_name: activeCandidate.last_name || "",
                        email: activeCandidate.email || "",
                        phone: activeCandidate.phone || "",
                        address: activeCandidate.address || "",
                        primary_skills: activeCandidate.primary_skills || "",
                        years_of_experience: activeCandidate.years_of_experience ?? "",
                        date_applied: activeCandidate.date_applied?.split("T")[0] || "",
                        date_sourced: activeCandidate.date_sourced?.split("T")[0] || "",
                        linkedin_url: activeCandidate.linkedin_url || "",
                      });
                    }
                    setShowEditModal(true);
                  }}
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </button>
                {!candidate.dnh_flag && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md bg-red-900/40 border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-100 hover:bg-red-800/60 transition-colors"
                    onClick={() => setShowDNHModal(true)}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Flag DNH
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Delete candidate"
                  className="flex items-center gap-1.5 rounded-md bg-danger px-2.5 py-1 text-xs font-medium text-white hover:bg-danger/90 transition-colors"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Candidate
                </button>
                <button
                  type="button"
                  aria-label="Close profile"
                  className="text-white hover:text-white/70"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-secondary/90">
                {candidate.jobs?.title ?? "No job assigned"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={candidate.pipeline_stage || "new_application"}
                  onChange={(e) => onStageChange?.(candidate, e.target.value)}
                  className="appearance-none rounded-full bg-secondary px-3 py-1 pr-8 text-xs font-medium text-white outline-none cursor-pointer hover:bg-secondary/90 transition-colors border-none"
                >
                  {Object.entries(STAGE_TITLES).map(([key, label]) => (
                    <option key={key} value={key} className="bg-white text-slate-900">
                      {label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                  <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              
              {candidate.pipeline_stage !== "disqualified" && candidate.pipeline_stage !== "hired" && (
                <>
                  <button 
                    onClick={() => {
                      const stages = Object.keys(STAGE_TITLES).filter(s => s !== "disqualified" && s !== "hired");
                      const currentIndex = stages.indexOf(candidate.pipeline_stage || "new_application");
                      if (currentIndex >= 0 && currentIndex < stages.length - 1) {
                        onStageChange?.(candidate, stages[currentIndex + 1]);
                      } else if (currentIndex === stages.length - 1) {
                        onStageChange?.(candidate, "hired");
                      }
                    }}
                    className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                  >
                    Advance
                  </button>
                  <button 
                    onClick={() => onStageChange?.(candidate, "disqualified")}
                    className="rounded-md border border-danger/50 bg-danger/20 px-2 py-1 text-xs font-medium text-white hover:bg-danger/40 transition-colors"
                  >
                    Reject
                  </button>
                </>
              )}

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_VARIANT_STYLES[getSourceBadgeVariant(candidate)]}`}
              >
                {sourceBadgeLabel(candidate)}
              </span>

              {originInfo.date && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white shadow-sm border border-white/20">
                  <CalendarClock className="h-3.5 w-3.5 text-white/90" />
                  {originInfo.label}: {originInfo.date}
                </span>
              )}
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
              {candidate.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {candidate.address}
                </span>
              )}
              {candidate.linkedin_url && (
                <a
                  href={candidate.linkedin_url.startsWith("http") ? candidate.linkedin_url : `https://${candidate.linkedin_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-200 hover:text-white underline transition-colors"
                  title="Open LinkedIn Profile"
                >
                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0-.02-3.28 1.64 1.64 0 0 0 .02 3.28m1.39 9.74v-8.37H5.07v8.37h2.78z" />
                  </svg>
                  LinkedIn
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowOutreachModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 px-2.5 py-0.5 text-xs font-semibold text-white border border-white/25 transition shadow-xs cursor-pointer ml-auto"
                title="Generate AI Outreach (Email, LinkedIn, Indeed)"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>AI Outreach</span>
              </button>
            </div>
          </div>
          
          {showDeleteConfirm && (
            <div className="bg-danger/10 p-4 border-b border-danger/20">
              <p className="text-sm text-danger font-medium mb-2">Are you sure you want to delete this candidate? This action cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-danger text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-danger/90 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete Candidate"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="bg-white text-slate-700 border border-slate-300 px-3 py-1.5 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {candidate.dnh_flag && (
            <div className="bg-red-50 border-l-4 border-red-600 p-4 shrink-0 shadow-sm relative">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-red-800 font-bold text-sm tracking-wide uppercase flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> DO NOT HIRE
                  </h3>
                  <div className="mt-1.5 text-xs text-red-700/90 flex flex-wrap gap-x-3 gap-y-1">
                    <span><strong className="font-semibold text-red-800">Flagged on:</strong> {candidate.dnh_date}</span>
                    <span><strong className="font-semibold text-red-800">Recruiter:</strong> {candidate.dnh_recruiter}</span>
                  </div>
                  {candidate.dnh_reason && (
                    <div className="mt-2 text-sm text-red-900 bg-red-100/50 p-2.5 rounded border border-red-200">
                      {candidate.dnh_reason}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleRemoveDNH}
                  disabled={isSavingDnh}
                  className="text-xs bg-white text-red-600 border border-red-200 px-2.5 py-1.5 rounded shadow-sm hover:bg-red-50 hover:text-red-700 font-medium whitespace-nowrap transition-colors disabled:opacity-50"
                >
                  Remove Flag
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col gap-6 p-6 relative">
            {showEditModal && (
              <div className="absolute inset-0 bg-slate-900/20 z-20 flex items-start justify-center p-4 backdrop-blur-[1px]">
                <div className="bg-white rounded-lg shadow-xl w-full p-5 border border-slate-200 mt-2 max-h-full overflow-y-auto">
                  <h3 className="text-slate-900 font-bold mb-4 flex items-center gap-2">
                    <Edit className="h-5 w-5" /> Edit Profile
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">First Name *</label>
                        <input type="text" value={editForm.first_name} onChange={(e) => setEditForm({...editForm, first_name: e.target.value})} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Last Name *</label>
                        <input type="text" value={editForm.last_name} onChange={(e) => setEditForm({...editForm, last_name: e.target.value})} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                        <input type="email" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone</label>
                        <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Address</label>
                      <input type="text" value={editForm.address} onChange={(e) => setEditForm({...editForm, address: e.target.value})} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="City, State" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">LinkedIn Profile URL</label>
                      <input type="url" value={editForm.linkedin_url} onChange={(e) => setEditForm({...editForm, linkedin_url: e.target.value})} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="https://linkedin.com/in/username" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Primary Skills (comma separated)</label>
                      <input type="text" value={editForm.primary_skills} onChange={(e) => setEditForm({...editForm, primary_skills: e.target.value})} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Years of Experience</label>
                        <input type="number" value={editForm.years_of_experience} onChange={(e) => setEditForm({...editForm, years_of_experience: e.target.value})} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" min="0" step="1" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {candidate.source_type === "outbound" || candidate.source_type === "sourced" ? "Date Sourced" : "Date Applied"}
                        </label>
                        <input
                          type="date"
                          value={candidate.source_type === "outbound" || candidate.source_type === "sourced" ? editForm.date_sourced : editForm.date_applied}
                          onChange={(e) => {
                            if (candidate.source_type === "outbound" || candidate.source_type === "sourced") {
                              setEditForm({ ...editForm, date_sourced: e.target.value });
                            } else {
                              setEditForm({ ...editForm, date_applied: e.target.value });
                            }
                          }}
                          className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                      <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors text-slate-700">Cancel</button>
                      <button onClick={handleSaveProfile} disabled={isSavingProfile || !editForm.first_name || !editForm.last_name} className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90 font-medium transition-colors disabled:opacity-50">
                        {isSavingProfile ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {showDNHModal && (
              <div className="absolute inset-0 bg-slate-900/20 z-10 flex items-start justify-center p-4 backdrop-blur-[1px]">
                <div className="bg-white rounded-lg shadow-xl w-full p-5 border border-slate-200 mt-2">
                  <h3 className="text-red-600 font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> Flag as Do-Not-Hire
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date Flagged *</label>
                        <input type="date" value={dnhDate} onChange={(e) => setDnhDate(e.target.value)} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Recruiter Name *</label>
                        <input type="text" value={dnhRecruiter} onChange={(e) => setDnhRecruiter(e.target.value)} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none" placeholder="Your name" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason / Notes *</label>
                      <textarea value={dnhReason} onChange={(e) => setDnhReason(e.target.value)} className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white resize-none focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none" rows={3} placeholder="Why is this candidate being flagged?" />
                    </div>
                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                      <button onClick={() => setShowDNHModal(false)} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors text-slate-700">Cancel</button>
                      <button onClick={handleSetDNH} disabled={isSavingDnh} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 font-medium transition-colors disabled:opacity-50">Confirm Flag</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Candidate Resume Document Card */}
            <section className="rounded-xl border bg-white p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg shrink-0 ${activeCandidate?.resume_url ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-slate-100 text-slate-400"}`}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-800">Uploaded Resume</h4>
                      {activeCandidate?.resume_url ? (
                        <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold">
                          PDF Available
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                          No File Uploaded
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeCandidate?.resume_url
                        ? "Stored in Supabase. Click below to view in a new tab."
                        : "Upload a PDF, DOCX, or TXT resume for this candidate when ready."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {activeCandidate?.resume_url && (
                    <a
                      href={activeCandidate.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      View PDF
                    </a>
                  )}

                  <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer shadow-2xs transition-colors ${
                    activeCandidate?.resume_url
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                      : "bg-primary hover:bg-primary/90 text-white"
                  } ${isUploadingResume ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="h-3.5 w-3.5" />
                    <span>{isUploadingResume ? "Uploading..." : activeCandidate?.resume_url ? "Replace File" : "Upload Resume"}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleResumeUpload(file);
                        e.target.value = "";
                      }}
                      disabled={isUploadingResume}
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    <span>AI Fit Summary</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Pass 1 Fast Intake
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleReEvaluateFit}
                    disabled={isReEvaluating}
                    title="Re-evaluate Fit against current job description"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 text-slate-500 ${isReEvaluating ? "animate-spin text-secondary" : ""}`} />
                    <span>{isReEvaluating ? "Evaluating..." : "Re-evaluate"}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowScorecardModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-xs font-semibold text-secondary hover:bg-secondary/20 transition shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {evaluations.some((ev) => ev.reviewer_name?.includes("AI") || ev.notes?.includes("Hard Gate"))
                    ? "View Deep Scorecard"
                    : "Generate AI Scorecard"}
                </button>
              </div>
              
              {activeCandidate?.fit_rating != null && (
                <div className="mt-3 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        activeCandidate.fit_rating != null && i < activeCandidate.fit_rating
                          ? "fill-amber-500 text-amber-500"
                          : "text-slate-300"
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-sm font-medium text-slate-700">
                    {activeCandidate.fit_rating}/5 Fit
                  </span>
                </div>
              )}

              {activeCandidate?.sub_scores && (
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <div className="text-center">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Experience</div>
                    <div className="text-sm font-semibold text-slate-800 mt-0.5">
                      {activeCandidate.sub_scores.functionalExperience ?? "-"}/5
                    </div>
                  </div>
                  <div className="text-center border-x border-slate-200">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Credentials</div>
                    <div className="text-sm font-semibold text-slate-800 mt-0.5">
                      {activeCandidate.sub_scores.requiredCredentials ?? "-"}/5
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Skills</div>
                    <div className="text-sm font-semibold text-slate-800 mt-0.5">
                      {activeCandidate.sub_scores.roleSpecificSkills ?? "-"}/5
                    </div>
                  </div>
                </div>
              )}

              {((activeCandidate?.fit_rating != null && activeCandidate.fit_rating <= 2) ||
                evaluations.some((ev) => ev.recommendation?.toLowerCase().includes("reject") || ev.notes?.includes("DO NOT ADVANCE"))) &&
                activeCandidate?.pipeline_stage !== "disqualified" && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-900 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>AI Screening Alert:</strong> Low alignment score with critical qualification gaps.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => activeCandidate && onStageChange?.(activeCandidate, "disqualified")}
                    className="shrink-0 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-xs cursor-pointer"
                  >
                    Disqualify Candidate
                  </button>
                </div>
              )}

              <p className="mt-3 text-sm text-slate-700">
                {activeCandidate?.ai_summary || "No AI summary available for this candidate yet."}
              </p>
              {activeCandidate?.years_of_experience != null &&
                activeCandidate.years_of_experience > 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    <span className="font-medium text-primary">Experience:</span>{" "}
                    {activeCandidate.years_of_experience} yrs
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
                    activeTab === "experience"
                      ? "text-primary border-b-2 border-primary"
                      : "text-slate-500"
                  }`}
                  onClick={() => setActiveTab("experience")}
                >
                  Experience
                </button>
                <button
                  type="button"
                  className={`text-sm font-medium pb-1 ${
                    activeTab === "evaluations"
                      ? "text-primary border-b-2 border-primary"
                      : "text-slate-500"
                  }`}
                  onClick={() => setActiveTab("evaluations")}
                >
                  Evaluations
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
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
                    <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100">
                      <div className="flex flex-wrap gap-2">
                        {["Call Note", "Interview Note", "General Note", "Status Update"].map((type) => (
                          <button
                            key={type}
                            onClick={() => setNoteType(type)}
                            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-200 border ${
                              noteType === type
                                ? "bg-secondary text-white border-secondary shadow-md shadow-secondary/20 scale-[1.02]"
                                : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200 shadow-sm"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-1">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Log a call note, recruiter update, or outreach comment..."
                        className="w-full text-slate-900 bg-transparent border-0 rounded-lg p-3 text-sm outline-none placeholder:text-slate-400 focus:ring-0 resize-none min-h-[80px]"
                        rows={3}
                      />
                    </div>
                    <div className="bg-slate-50/80 px-4 py-3 flex items-center justify-between border-t border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/10 text-[10px] font-bold text-secondary">
                          {activeRecruiter?.name?.charAt(0) || "R"}
                        </div>
                        <span className="text-xs text-slate-500">
                          Posting as <span className="font-semibold text-slate-700">{activeRecruiter?.name || "Recruiter"}</span>
                        </span>
                      </div>
                      <button
                        onClick={handleAddNote}
                        disabled={isSubmittingNote || !noteText.trim()}
                        className="inline-flex items-center justify-center rounded-lg bg-secondary px-5 py-2 text-sm font-semibold text-white hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:ring-offset-2 disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
                      >
                        {isSubmittingNote ? "Saving..." : "Log Activity"}
                      </button>
                    </div>
                  </div>

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
              ) : activeTab === "evaluations" ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 transition shadow-xs"
                      onClick={() => setShowEvaluationModal(true)}
                    >
                      Submit Recruiter Evaluation
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-secondary bg-secondary/10 px-3 py-2 text-sm font-medium text-secondary hover:bg-secondary/20 transition shadow-xs"
                      onClick={() => setShowScorecardModal(true)}
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate AI Scorecard
                    </button>
                  </div>
                  {evaluations.length > 0 ? (
                    evaluations.map((ev) => {
                      const isAiScorecard = ev.reviewer_name?.includes("AI") || ev.notes?.includes("Hard Gate");
                      return (
                        <div
                          key={ev.id}
                          className={`rounded-lg border px-4 py-3 ${
                            isAiScorecard
                              ? "border-secondary/30 bg-secondary/5"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-primary flex items-center gap-1">
                                {isAiScorecard && <Sparkles className="h-3.5 w-3.5 text-secondary" />}
                                {ev.reviewer_name}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${recommendationStyle(ev.recommendation)}`}
                              >
                                {ev.recommendation}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                              <Star className="h-4 w-4 text-warning" />
                              {(ev.aggregate_score ?? 0).toFixed(1)} / 5.0
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                            <CalendarClock className="h-3 w-3" />
                            {new Date(ev.created_at).toLocaleString()}
                          </div>
                          {isAiScorecard ? (
                            <div className="mt-3 flex items-center justify-between border-t border-secondary/20 pt-3">
                              <span className="text-xs text-slate-600 font-medium">
                                Evidence-backed scorecard & interview probes
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowScorecardModal(true)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
                              >
                                <Sparkles className="h-3 w-3" />
                                View Full Scorecard
                              </button>
                            </div>
                          ) : (
                            <>
                              {ev.scores && Object.keys(ev.scores).length > 0 && (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  {Object.entries(ev.scores).map(([key, value]) => (
                                    <div
                                      key={key}
                                      className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1.5"
                                    >
                                      <span className="text-xs text-slate-500">
                                        {key.replace(/_/g, " ")}
                                      </span>
                                      <span className="text-xs font-semibold text-primary">
                                        {value} / 5
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {ev.notes && (
                                <p className="mt-3 text-sm text-slate-700">{ev.notes}</p>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400">
                      No evaluations submitted yet for this candidate.
                    </p>
                  )}
                </div>
              ) : activeTab === "experience" ? (
                <div className="mt-3 flex flex-col gap-4">
                  {candidate.work_experience && candidate.work_experience.length > 0 ? (
                    <div className="relative border-l-2 border-slate-200 ml-3 pl-5 space-y-6">
                      {candidate.work_experience.map((exp, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-white bg-primary"></div>
                          <h4 className="text-sm font-semibold text-primary">{exp.jobTitle}</h4>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1.5">
                            <span>{exp.company}</span>
                            <span>•</span>
                            <span>{exp.dates}</span>
                          </div>
                          <p className="text-sm text-slate-700">{exp.summary}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      No parsed experience available.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {documents.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {documents.map((doc) => (
                        <DocumentCard 
                          key={doc.id} 
                          doc={doc} 
                          onRefresh={refreshDocuments} 
                          activeRecruiterName={activeRecruiter?.name}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      No required documents tracked yet for this candidate.
                    </p>
                  )}
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold text-primary">
                      Add Document Requirement
                    </p>
                    <select
                      value={newDocName}
                      onChange={(e) => {
                        const selectedDoc = STANDARD_COMPLIANCE_DOCUMENTS.find(doc => doc.name === e.target.value);
                        setNewDocName(e.target.value);
                        if (selectedDoc) {
                          setNewDocCategory(selectedDoc.category);
                          setNewDocRequiresExpiration(selectedDoc.requiresExpiration);
                        }
                      }}
                      className="mt-2 w-full appearance-none rounded-md px-3 py-1.5 text-sm outline-none cursor-pointer text-slate-900 font-medium bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_COMPLIANCE_DOCUMENTS.map((doc) => (
                        <option key={doc.name} value={doc.name}>
                          {doc.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newDocCategory}
                      readOnly
                      className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 outline-none cursor-not-allowed"
                      title="Category auto-populates based on document"
                    />
                    <button
                      type="button"
                      disabled={isAddingDoc || !newDocName.trim()}
                      onClick={handleAddDocumentRequirement}
                      className="mt-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isAddingDoc ? "Adding..." : "+ Add Document Requirement"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </aside>
      )}
      <EvaluationModal
        candidate={candidate}
        open={showEvaluationModal}
        onClose={() => setShowEvaluationModal(false)}
        onSubmitted={() => {
          if (!candidate) return;
          getEvaluationsByCandidate(candidate.id)
            .then((evs) => {
              setEvaluations(evs);
              onCandidateUpdated?.({
                ...candidate,
                evaluations: evs,
              });
            })
            .catch(() => setEvaluations([]));
        }}
      />
      <ScorecardViewerModal
        candidate={candidate}
        open={showScorecardModal}
        onClose={() => setShowScorecardModal(false)}
        existingMarkdown={
          evaluations.find(
            (ev) => ev.reviewer_name?.includes("AI") || ev.notes?.includes("Hard Gate")
          )?.notes || null
        }
        onScorecardGenerated={async (_markdown, updatedCandidate) => {
          if (!candidate) return;
          const [evs, acts, freshCandidate] = await Promise.all([
            getEvaluationsByCandidate(candidate.id),
            getCandidateActivity(candidate.id),
            getCandidateById(candidate.id),
          ]);
          setEvaluations(evs);
          setActivity(acts);
          const baseCandidate = freshCandidate || updatedCandidate || candidate;
          const updated = {
            ...baseCandidate,
            evaluations: evs,
          };
          setLocalCandidate(updated);
          onCandidateUpdated?.(updated);
        }}
      />
      <AiOutreachModal
        open={showOutreachModal}
        onClose={() => setShowOutreachModal(false)}
        candidate={activeCandidate}
        onActivityLogged={async () => {
          if (!activeCandidate) return;
          const acts = await getCandidateActivity(activeCandidate.id);
          setActivity(acts);
        }}
      />
    </div>
  );
}