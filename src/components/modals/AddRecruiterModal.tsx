"use client";

import { useState } from "react";
import { useRecruiter } from "@/context/RecruiterContext";
import { createRecruiter } from "@/app/actions/recruiters";
import { X } from "lucide-react";

interface AddRecruiterModalProps {
  onClose: () => void;
}

export default function AddRecruiterModal({ onClose }: AddRecruiterModalProps) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Recruiter");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setActiveRecruiter, refreshRecruiters } = useRecruiter();

  const inputClass =
    "w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 font-normal focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const email = `${emailPrefix}@rfcservice.com`;
      const newRecruiter = await createRecruiter({ name, title, email });
      await refreshRecruiters();
      setActiveRecruiter(newRecruiter);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create recruiter");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-primary">Add Recruiter</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2 text-sm text-accent-danger bg-red-50 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              className={`${inputClass} rounded-md`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Vance"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Title
            </label>
            <input
              type="text"
              className={`${inputClass} rounded-md`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recruiter"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <div className="flex rounded-md shadow-sm">
              <input
                type="text"
                required
                className={`${inputClass} flex-1 min-w-0 block rounded-none rounded-l-md`}
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value)}
                placeholder="username"
              />
              <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium sm:text-sm">
                @rfcservice.com
              </span>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name || !emailPrefix}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add Recruiter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
