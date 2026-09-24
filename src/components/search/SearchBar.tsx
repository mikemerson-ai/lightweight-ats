"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { type Candidate } from "@/app/actions/candidates";

export function SearchBar({ onSelectCandidate }: { onSelectCandidate?: (candidate: Candidate) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();

    debounceRef.current = setTimeout(async () => {
      if (!trimmed) {
        setResults([]);
        setOpen(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase
          .from("candidates")
          .select("*, jobs(title), evaluations(id, candidate_id, reviewer_name, recommendation, aggregate_score, notes, created_at)")
          .or(
            `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,pipeline_stage.ilike.%${trimmed}%`
          )
          .limit(10);

        if (error) throw error;
        setResults(data as Candidate[]);
        setOpen(true);
      } catch (err: any) {
        console.error("Search failed:", err);
        toast.error("Failed to perform search. Please try again.");
        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, trimmed ? 300 : 0);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2.5">
        <Search className="h-4 w-4 text-slate-500 hover:text-slate-700" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidates by name, skill, email..."
          className="flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading ? (
          <span className="h-3 w-3 animate-pulse rounded-full bg-secondary" />
        ) : query ? (
          <button
            type="button"
            aria-label="Clear search"
            className="text-slate-500 hover:text-slate-700"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && query.trim() && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm font-normal text-slate-600">
              No candidates found
            </div>
          ) : (
            results.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50"
                onClick={() => {
                  onSelectCandidate?.(candidate);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">
                    {candidate.first_name} {candidate.last_name}
                  </span>
                  <span className="text-xs text-slate-600">
                    {candidate.jobs?.title ?? "No job assigned"}
                  </span>
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {candidate.pipeline_stage?.replace(/_/g, " ") ?? "New Application"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}