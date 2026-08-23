"use client";

import { useState, useRef, useEffect } from "react";
import { useRecruiter } from "@/context/RecruiterContext";
import { UserCircle, ChevronDown, Plus, Check } from "lucide-react";
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

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 animate-pulse text-gray-400">
        <UserCircle className="w-8 h-8" />
        <div className="h-4 w-24 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-secondary"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
          <UserCircle className="w-6 h-6" />
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-sm font-semibold text-primary">
            {activeRecruiter?.name || "No Recruiter"}
          </div>
          <div className="text-xs text-gray-500">
            {activeRecruiter?.title || "Recruiter"}
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-100 z-50">
          <div className="py-1 max-h-64 overflow-auto">
            {recruiters.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No recruiters found.
              </div>
            ) : (
              recruiters.map((recruiter) => (
                <button
                  key={recruiter.id}
                  onClick={() => {
                    setActiveRecruiter(recruiter);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 ${
                    activeRecruiter?.id === recruiter.id ? "bg-gray-50" : ""
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className={`font-medium ${activeRecruiter?.id === recruiter.id ? "text-primary" : "text-gray-700"}`}>
                      {recruiter.name}
                    </span>
                    <span className="text-xs text-gray-500">{recruiter.title}</span>
                  </div>
                  {activeRecruiter?.id === recruiter.id && (
                    <Check className="w-4 h-4 text-secondary" />
                  )}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-gray-100 p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                setIsModalOpen(true);
              }}
              className="w-full flex items-center justify-center space-x-1 px-4 py-2 text-sm font-medium text-secondary bg-secondary/5 rounded-md hover:bg-secondary/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Recruiter</span>
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <AddRecruiterModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}
