"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Car, Clock, MapPin, ChevronDown, ChevronUp, Check, AlertCircle, Edit2 } from "lucide-react";
import type { Candidate } from "@/app/actions/candidates";
import type { GroupHome } from "@/types/groupHomes";
import { SHIFT_OPTIONS, type ShiftPreference } from "@/types/groupHomes";
import { calculateGroupHomeDistances, normalizeZipCode } from "@/lib/geo/commute";

interface DspCommuteBreakdownWidgetProps {
  candidate: Candidate;
  groupHomes: GroupHome[];
  onUpdateZip: (newZip: string) => Promise<void>;
  onToggleShift: (shift: string) => Promise<void>;
}

export function DspCommuteBreakdownWidget({
  candidate,
  groupHomes,
  onUpdateZip,
  onToggleShift,
}: DspCommuteBreakdownWidgetProps) {
  const [isEditingZip, setIsEditingZip] = useState(false);
  const [zipInput, setZipInput] = useState(candidate.zip_code || "");
  const [isSavingZip, setIsSavingZip] = useState(false);
  const [showAllHomes, setShowAllHomes] = useState(false);

  const activeZips = normalizeZipCode(candidate.zip_code);
  const proximities = activeZips && groupHomes.length > 0
    ? calculateGroupHomeDistances(activeZips, groupHomes)
    : [];

  const closestHome = proximities.length > 0 && proximities[0].distanceMiles !== null
    ? proximities[0]
    : null;

  async function handleSaveZip(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const clean = normalizeZipCode(zipInput);
    if (!clean) {
      toast.error("Please enter a valid 5-digit US ZIP code.");
      return;
    }
    setIsSavingZip(true);
    try {
      await onUpdateZip(clean);
      setIsEditingZip(false);
    } finally {
      setIsSavingZip(false);
    }
  }

  function getDistanceBadge(miles: number | null) {
    if (miles === null || miles === undefined) {
      return { label: "Unknown", color: "bg-slate-100 text-slate-600 border-slate-200" };
    }
    if (miles <= 5) {
      return { label: "Very Close", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (miles <= 10) {
      return { label: "Great Commute", color: "bg-sky-50 text-sky-700 border-sky-200" };
    }
    if (miles <= 18) {
      return { label: "Moderate Commute", color: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    return { label: "Long Commute", color: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  return (
    <div className="rounded-xl border border-sky-100 bg-linear-to-b from-sky-50/60 to-white p-4.5 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white shadow-2xs">
            <Car className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-slate-900">DSP Shift & Commute Proximity</h4>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                DSP Match
              </span>
            </div>
            <p className="text-xs text-slate-500">Zero-latency offline distance to Reliance homes</p>
          </div>
        </div>

        {/* Candidate ZIP Tag / Inline Edit */}
        <div className="flex items-center gap-1.5">
          {isEditingZip ? (
            <form onSubmit={handleSaveZip} className="flex items-center gap-1.5">
              <input
                type="text"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                placeholder="5-digit ZIP"
                maxLength={5}
                className="w-24 rounded border border-sky-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
                autoFocus
              />
              <button
                type="submit"
                disabled={isSavingZip}
                className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {isSavingZip ? "..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingZip(false)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Candidate ZIP:</span>
              <button
                type="button"
                onClick={() => {
                  setZipInput(candidate.zip_code || "");
                  setIsEditingZip(true);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50/80 px-2 py-1 text-xs font-bold text-sky-900 hover:bg-sky-100 transition cursor-pointer"
                title="Click to edit ZIP code"
              >
                <MapPin className="h-3.5 w-3.5 text-sky-600" />
                {candidate.zip_code ? candidate.zip_code : "Set ZIP"}
                <Edit2 className="h-2.5 w-2.5 text-sky-400 ml-0.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1-Click Shift Preferences Pills */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-700">Available Shifts:</span>
          <span className="text-[11px] text-slate-400">(Click to toggle)</span>
        </div>
        <div className="flex items-center gap-1.5">
          {SHIFT_OPTIONS.map((shift) => {
            const isSelected = candidate.shift_preferences?.includes(shift.id);
            return (
              <button
                key={shift.id}
                type="button"
                onClick={() => onToggleShift(shift.id)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer shadow-2xs ${
                  isSelected
                    ? "bg-sky-600 text-white shadow-sky-600/20 ring-2 ring-sky-600 ring-offset-1"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                <span>{shift.icon}</span>
                <span>{shift.label}</span>
                {isSelected && <Check className="h-3 w-3 ml-0.5 text-white" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Commute Breakdown Section */}
      <div className="mt-3.5">
        {!activeZips ? (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50/90 border border-amber-200 p-3 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <span className="font-semibold">ZIP code not set for this candidate.</span>{" "}
              Enter their ZIP above to view driving distance and commute times to all 15 Reliance group homes.
            </div>
          </div>
        ) : proximities.length === 0 ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
            No group homes loaded to calculate proximity.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Closest Home Banner */}
            {closestHome && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-emerald-950">Closest Home: {closestHome.home.name}</span>
                    <span className="text-emerald-700 ml-1.5 text-[11px]">
                      ({closestHome.home.address}, {closestHome.home.city})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="font-bold text-emerald-900 text-sm">
                    {closestHome.distanceMiles} mi
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100/90 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <Clock className="h-3 w-3" />
                    ~{closestHome.commuteMinutes} min
                  </span>
                </div>
              </div>
            )}

            {/* Top 3 Closest Homes */}
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="bg-slate-50/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                <span>Top Matching Group Homes</span>
                <span>Est. Commute</span>
              </div>
              {proximities.slice(0, showAllHomes ? proximities.length : 3).map((item, idx) => {
                const badge = getDistanceBadge(item.distanceMiles);
                return (
                  <div
                    key={item.home.id || idx}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50/60 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-center font-bold text-slate-400 text-[11px]">
                        {idx + 1}.
                      </span>
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {item.home.name}
                          <span className={`rounded px-1.5 py-0.2 text-[10px] font-medium border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.home.address}, {item.home.city} {item.home.zip_code}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <div className="text-right">
                        <div className="font-bold text-slate-800">
                          {item.distanceMiles !== null ? `${item.distanceMiles} mi` : "—"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.commuteMinutes !== null ? `~${item.commuteMinutes} min drive` : "Unavailable"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Toggle All 15 Locations */}
            {proximities.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllHomes(!showAllHomes)}
                className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                <span>{showAllHomes ? "Show Top 3 Only" : `View All ${proximities.length} Group Homes`}</span>
                {showAllHomes ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
