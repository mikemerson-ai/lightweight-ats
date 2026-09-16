"use client";

import { useState, useRef, useEffect } from "react";
import { useRecruiter } from "@/context/RecruiterContext";
import { UserCircle, ChevronUp, Plus, Check, Sparkles } from "lucide-react";
import AddRecruiterModal from "@/components/modals/AddRecruiterModal";

export default function RecruiterSwitcher() {
  const { activeRecruiter, recruiters, setActiveRecruiter, isLoading } = useRecruiter();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading && !activeRecruiter) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200/60 animate-pulse">
        <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-24 bg-slate-200 rounded" />
          <div className="h-2.5 w-16 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  const currentRecruiter = activeRecruiter || recruiters[0] || {
    id: "fallback",
    name: "Mike Pasaron",
    title: "Recruiter",
    email: "mepasaron@rfcservice.com",
  };

  const initials = currentRecruiter.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Upward Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 right-0 w-full min-w-[220px] bg-white rounded-xl shadow-xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Recruiter
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Team
            </span>
          </div>

          <div className="p-1.5 max-h-60 overflow-y-auto space-y-0.5">
            {recruiters.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500 text-center">
                No recruiters found.
              </div>
            ) : (
              recruiters.map((recruiter) => {
                const isSelected = currentRecruiter?.id === recruiter.id;
                const recInitials = recruiter.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <button
                    key={recruiter.id}
                    type="button"
                    onClick={() => {
                      setActiveRecruiter(recruiter);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-sky-50/80 text-sky-950 font-medium"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${
                          isSelected
                            ? "bg-sky-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {recInitials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold truncate leading-tight">
                          {recruiter.name}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate leading-tight">
                          {recruiter.title}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-sky-600 shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 p-1.5 bg-slate-50/50">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-50 border border-slate-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Recruiter</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Trigger Card */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2.5 p-2 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all duration-150 cursor-pointer text-left group"
        title="Switch active recruiter profile"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-600 text-white font-bold text-xs shadow-2xs group-hover:scale-105 transition-transform">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate leading-tight group-hover:text-sky-700 transition-colors">
              {currentRecruiter.name}
            </div>
            <div className="text-[11px] text-slate-500 truncate leading-tight">
              {currentRecruiter.title || "Recruiter"}
            </div>
          </div>
        </div>

        <div className="shrink-0 p-1 rounded-md text-slate-400 group-hover:text-slate-600 transition-transform">
          <ChevronUp
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-sky-600" : ""
            }`}
          />
        </div>
      </button>

      {isModalOpen && (
        <AddRecruiterModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}
