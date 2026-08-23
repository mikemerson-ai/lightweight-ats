"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getRecruiters, Recruiter } from "@/app/actions/recruiters";

interface RecruiterContextType {
  activeRecruiter: Recruiter | null;
  setActiveRecruiter: (recruiter: Recruiter) => void;
  recruiters: Recruiter[];
  refreshRecruiters: () => Promise<void>;
  isLoading: boolean;
}

const RecruiterContext = createContext<RecruiterContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "rfcs_active_recruiter";

export function RecruiterProvider({ children }: { children: React.ReactNode }) {
  const [activeRecruiter, setActiveRecruiterState] = useState<Recruiter | null>(null);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecruiters = async () => {
    try {
      const data = await getRecruiters();
      setRecruiters(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch recruiters", error);
      return [];
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const data = await fetchRecruiters();

      if (data && data.length > 0) {
        const storedRecruiterJson = localStorage.getItem(LOCAL_STORAGE_KEY);
        let matchedRecruiter = null;
        if (storedRecruiterJson) {
          try {
            const storedRecruiter = JSON.parse(storedRecruiterJson) as Recruiter;
            matchedRecruiter = data.find((r) => r.id === storedRecruiter.id) || null;
          } catch (e) {
            console.error("Failed to parse stored recruiter", e);
          }
        }

        if (matchedRecruiter) {
          setActiveRecruiterState(matchedRecruiter);
        } else {
          // Fallback to first active recruiter
          setActiveRecruiterState(data[0]);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data[0]));
        }
      }
      setIsLoading(false);
    };

    init();
  }, []);

  const setActiveRecruiter = (recruiter: Recruiter) => {
    setActiveRecruiterState(recruiter);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(recruiter));
  };

  const refreshRecruiters = async () => {
    await fetchRecruiters();
  };

  return (
    <RecruiterContext.Provider
      value={{
        activeRecruiter,
        setActiveRecruiter,
        recruiters,
        refreshRecruiters,
        isLoading,
      }}
    >
      {children}
    </RecruiterContext.Provider>
  );
}

export function useRecruiter() {
  const context = useContext(RecruiterContext);
  if (context === undefined) {
    throw new Error("useRecruiter must be used within a RecruiterProvider");
  }
  return context;
}
