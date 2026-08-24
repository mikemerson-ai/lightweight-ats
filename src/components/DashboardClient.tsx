"use client";

import { useState } from "react";
import { Job, getJobs, deleteJob } from "@/app/actions/jobs";
import { SearchBar } from "./search/SearchBar";
import { QuickAddSourcedModal } from "./modals/QuickAddSourcedModal";
import { CreateJobModal } from "./modals/CreateJobModal";
import { EditJobModal } from "./modals/EditJobModal";
import { KanbanBoard } from "./kanban/KanbanBoard";
import { AnalyticsModal } from "./analytics/AnalyticsModal";
import { Pencil, Trash2, AlertCircle, BarChart3 } from "lucide-react";
import RecruiterSwitcher from "./layout/RecruiterSwitcher";

export function DashboardClient({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    initialJobs.length > 0 ? initialJobs[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [editJobOpen, setEditJobOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCascadePrompt, setDeleteCascadePrompt] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleJobCreated = async () => {
    const updatedJobs = await getJobs();
    setJobs(updatedJobs);
    if (updatedJobs.length > 0 && !selectedJobId) {
      setSelectedJobId(updatedJobs[0].id);
    }
  };

  const handleJobUpdated = async () => {
    const updatedJobs = await getJobs();
    setJobs(updatedJobs);
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;

  const handleDeleteJob = async (forceCascade: boolean = false) => {
    if (!selectedJobId) return;
    
    setIsDeleting(true);
    setDeleteError("");
    
    try {
      await deleteJob(selectedJobId, forceCascade);
      const updatedJobs = await getJobs();
      setJobs(updatedJobs);
      setSelectedJobId(updatedJobs.length > 0 ? updatedJobs[0].id : null);
      setDeleteConfirmOpen(false);
      setDeleteCascadePrompt(false);
    } catch (err: any) {
      if (err.message === "Cannot_Delete_Has_Candidates") {
        setDeleteCascadePrompt(true);
      } else {
        setDeleteError(err.message || "Failed to delete job.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50 font-sans">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-primary">Lightweight ATS</h1>
          <div className="h-6 w-px bg-slate-200"></div>
          {jobs.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedJobId || ""}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-[250px] rounded-md bg-slate-50 border border-slate-300 px-3 py-2 text-sm text-[#0F2C59]"
              >
                <option value="" disabled>
                  Select Job Requisition
                </option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
              
              {selectedJobId && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditJobOpen(true)}
                    className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="Edit Job"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmOpen(true);
                      setDeleteCascadePrompt(false);
                      setDeleteError("");
                    }}
                    className="p-2 rounded-md text-slate-500 hover:text-danger hover:bg-danger/10 transition-colors"
                    title="Delete Job"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCreateJobOpen(true)}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            New Job
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setAnalyticsOpen(true)}
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-2"
            title="Analytics"
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline-block">Analytics</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
          <RecruiterSwitcher />
          <SearchBar />
          <select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(e.target.value as "all" | "inbound" | "outbound")
            }
            className="w-[180px] rounded-md bg-white border border-slate-300 px-3 py-2 text-sm text-[#0F2C59]"
          >
            <option value="all">All Sources</option>
            <option value="inbound">Direct Applicants</option>
            <option value="outbound">Outbound Sourced</option>
          </select>
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="rounded-md bg-[#0F2C59] px-4 py-2 text-sm font-medium text-[#F8FAFC] hover:bg-[#0EA5E9]"
          >
            Quick Add
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {selectedJobId ? (
          <KanbanBoard
            jobId={selectedJobId}
            searchQuery={searchQuery}
            sourceFilter={sourceFilter}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            Select or create a job requisition to view the pipeline.
          </div>
        )}
      </main>

      <QuickAddSourcedModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />

      <CreateJobModal
        open={createJobOpen}
        onClose={() => setCreateJobOpen(false)}
        onJobCreated={handleJobCreated}
      />

      <EditJobModal
        open={editJobOpen}
        job={selectedJob}
        onClose={() => setEditJobOpen(false)}
        onJobUpdated={handleJobUpdated}
      />

      <AnalyticsModal
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        jobs={jobs}
        initialJobId={selectedJobId}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-primary/50" onClick={() => !isDeleting && setDeleteConfirmOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border bg-white shadow-lg overflow-hidden">
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-3 text-danger">
                <AlertCircle className="w-6 h-6" />
                <h2 className="text-lg font-semibold">Delete Job</h2>
              </div>
              
              {!deleteCascadePrompt ? (
                <p className="text-slate-600">
                  Are you sure you want to delete the job <strong>{selectedJob?.title}</strong>? This action cannot be undone.
                </p>
              ) : (
                <div className="bg-danger/10 border border-danger/20 rounded-md p-4 text-sm text-danger-700">
                  <p className="font-semibold mb-2">This job has active candidates.</p>
                  <p>Deleting this job will also permanently delete all associated candidates, their activity logs, and documents.</p>
                  <p className="mt-2 font-medium">Are you sure you want to proceed with cascade deletion?</p>
                </div>
              )}

              {deleteError && (
                <p className="text-sm text-danger">{deleteError}</p>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="flex-1 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 disabled:opacity-50"
                  onClick={() => handleDeleteJob(deleteCascadePrompt)}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : deleteCascadePrompt ? "Yes, Delete Everything" : "Delete Job"}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteCascadePrompt(false);
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
