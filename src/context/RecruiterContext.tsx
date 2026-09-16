"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getRecruiters } from "@/app/actions/recruiters";
import type { Recruiter } from "@/types/recruiters";
import { DEFAULT_RECRUITERS } from "@/types/recruiters";

interface RecruiterContextType {
  activeRecruiter: Recruiter | null;
  setActiveRecruiter: (recruiter: Recruiter) => void;
  recruiters: Recruiter[];
  refreshRecruiters: () => Promise<void>;
  isLoading: boolean;
}

const RecruiterContext = createContext<RecruiterContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "rfcs_active_recruiter";

export function RecruiterProvider({
  children,
  initialRecruiters = [],
}: {
  children: React.ReactNode;
  initialRecruiters?: Recruiter[];
}) {
  const baseRecruiters = initialRecruiters.length > 0 ? initialRecruiters : DEFAULT_RECRUITERS;
  const [recruiters, setRecruiters] = useState<Recruiter[]>(baseRecruiters);
  const [activeRecruiter, setActiveRecruiterState] = useState<Recruiter | null>(
    baseRecruiters.length > 0 ? baseRecruiters[0] : null,
  );
  const [isLoading, setIsLoading] = useState(initialRecruiters.length === 0 && DEFAULT_RECRUITERS.length === 0);

  const fetchRecruiters = async () => {
    try {
      const data = await getRecruiters();
      if (data && data.length > 0) {
        setRecruiters(data);
        return data;
      }
      return baseRecruiters;
    } catch (error) {
      console.error("Failed to fetch recruiters", error);
      return baseRecruiters;
    }
  };

  useEffect(() => {
    const init = async () => {
      let currentList = recruiters;
      if (currentList.length === 0) {
        currentList = await fetchRecruiters();
      }

      if (currentList && currentList.length > 0) {
        const storedRecruiterJson = localStorage.getItem(LOCAL_STORAGE_KEY);
        let matchedRecruiter: Recruiter | null = null;
        if (storedRecruiterJson) {
          try {
            const storedRecruiter = JSON.parse(storedRecruiterJson) as Recruiter;
            matchedRecruiter = currentList.find((r) => r.id === storedRecruiter.id) || null;
          } catch (e) {
            console.error("Failed to parse stored recruiter", e);
          }
        }

        if (matchedRecruiter) {
          setActiveRecruiterState(matchedRecruiter);
        } else {
          setActiveRecruiterState(currentList[0]);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentList[0]));
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
