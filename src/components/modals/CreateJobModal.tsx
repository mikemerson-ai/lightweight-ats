"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createJob } from "@/app/actions/jobs";

interface CreateJobModalProps {
  open: boolean;
  onClose: () => void;
  onJobCreated: () => void;
}

export function CreateJobModal({
  open,
  onClose,
  onJobCreated,
}: CreateJobModalProps) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [targetHeadcount, setTargetHeadcount] = useState("1");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return null;
  }

  function reset() {
    setTitle("");
    setDepartment("");
    setTargetHeadcount("1");
    setDescription("");
    setRequirements("");
    setError("");
  }

  async function handleSubmit() {
    if (!title || !department || !description || !requirements || !targetHeadcount) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("department", department);
      formData.set("description", description);
      formData.set("requirements", requirements);
      formData.set("target_headcount", targetHeadcount);

      await createJob(formData);
      reset();
      onJobCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 font-normal focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border bg-white shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between bg-primary px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Create New Job</h2>
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
            <span className="text-sm font-medium text-primary">Job Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">Department *</span>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              Target Headcount *
            </span>
            <input
              type="number"
              min="1"
              value={targetHeadcount}
              onChange={(e) => setTargetHeadcount(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              Job Description *
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the responsibilities and day-to-day of this role..."
              className={`${inputClass} resize-none`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">
              Key Requirements / Qualifications *
            </span>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={4}
              placeholder="List the necessary skills, experience, and qualifications..."
              className={`${inputClass} resize-none`}
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Job"}
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
