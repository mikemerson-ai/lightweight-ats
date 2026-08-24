"use client";

import { useState } from "react";
import { Candidate } from "@/app/actions/candidates";

export const DISQUALIFICATION_REASONS = [
  "Did not meet requirements",
  "Missing qualifications",
  "Salary Mismatch",
  "Location/Commute",
  "Other",
];

interface DisqualificationModalProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function DisqualificationModal({
  candidate,
  isOpen,
  onClose,
  onConfirm,
}: DisqualificationModalProps) {
  const [reason, setReason] = useState<string>("");

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason);
    setReason("");
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/50" onClick={onClose} />
      <div className="relative w-full max-w-[425px] rounded-xl border bg-white shadow-lg">
        <div className="flex items-center justify-between bg-primary px-5 py-4">
          <h2 className="text-lg font-semibold text-white">
            Disqualify Candidate
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="text-white hover:text-white/70"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <div className="grid gap-4 p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Please select a reason for disqualifying{" "}
            <span className="font-medium text-slate-900">
              {candidate?.first_name} {candidate?.last_name}
            </span>
            .
          </p>
          <div className="grid gap-2">
            <label
              htmlFor="reason"
              className="text-sm font-medium text-primary"
            >
              Disqualification Reason
            </label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-slate-900 dark:text-slate-100 font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md px-3 py-2 text-sm focus:outline-none transition-colors"
            >
              <option value="" disabled className="text-slate-400">
                Select a reason
              </option>
              {DISQUALIFICATION_REASONS.map((r) => (
                <option
                  key={r}
                  value={r}
                  className="text-slate-900 dark:text-slate-100 font-medium bg-white dark:bg-slate-800"
                >
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button
            type="button"
            className="text-slate-700 dark:text-slate-200 font-medium bg-white hover:bg-slate-50 border border-slate-300 dark:border-slate-600 rounded-md px-4 py-2 text-sm transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            onClick={handleConfirm}
            disabled={!reason}
          >
            Disqualify
          </button>
        </div>
      </div>
    </div>
  );
}