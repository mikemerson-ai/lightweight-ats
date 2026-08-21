"use client";

import { useState } from "react";
import { Job } from "@/app/actions/jobs";
import { SearchBar } from "./search/SearchBar";
import { QuickAddSourcedModal } from "./modals/QuickAddSourcedModal";
import { KanbanBoard } from "./kanban/KanbanBoard";


export function DashboardClient({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs] = useState<Job[]>(initialJobs);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    initialJobs.length > 0 ? initialJobs[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-slate-50 font-sans">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-primary">Lightweight ATS</h1>
          <div className="h-6 w-px bg-slate-200"></div>
          {jobs.length > 0 && (
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
          )}
        </div>
        <div className="flex items-center gap-4">
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
    </div>
  );
}
