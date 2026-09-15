"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Car,
  Clock,
  Search,
  Filter,
  Users,
  Building2,
  CalendarClock,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import type { Candidate } from "@/app/actions/candidates";
import { getDspCandidates } from "@/app/actions/candidates";
import type { GroupHome } from "@/types/groupHomes";
import { SHIFT_OPTIONS, type ShiftPreference } from "@/types/groupHomes";
import { getGroupHomes } from "@/app/actions/groupHomes";
import {
  calculateDistanceMiles,
  calculateCommuteMinutes,
  findClosestGroupHome,
  normalizeZipCode,
} from "@/lib/geo/commute";
import { CandidateDetailDrawer } from "@/components/candidates/CandidateDetailDrawer";

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  new_application: { label: "New App", color: "bg-blue-50 text-blue-700 border-blue-200" },
  screening: { label: "Screening", color: "bg-purple-50 text-purple-700 border-purple-200" },
  interview: { label: "Interview", color: "bg-amber-50 text-amber-700 border-amber-200" },
  completing_requirements: { label: "Requirements", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  offer: { label: "Offer", color: "bg-teal-50 text-teal-700 border-teal-200" },
  background_checks: { label: "Background", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  hired: { label: "Hired", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  disqualified: { label: "Rejected", color: "bg-rose-50 text-rose-700 border-rose-200" },
};

export function DspLeadMatchingView() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [groupHomes, setGroupHomes] = useState<GroupHome[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHomeId, setSelectedHomeId] = useState<string>("all");
  const [selectedRadius, setSelectedRadius] = useState<number | "any">(15);
  const [selectedShifts, setSelectedShifts] = useState<ShiftPreference[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"distance" | "commute" | "name" | "recent">("distance");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [drawerCandidate, setDrawerCandidate] = useState<Candidate | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [candidatesData, homesData] = await Promise.all([
        getDspCandidates(),
        getGroupHomes(),
      ]);
      setCandidates(candidatesData);
      setGroupHomes(homesData);
    } catch (err) {
      console.error("Failed to load DSP lead matching data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedHome = useMemo(() => {
    if (selectedHomeId === "all") return null;
    return groupHomes.find((h) => h.id === selectedHomeId) || null;
  }, [selectedHomeId, groupHomes]);

  // Compute distance and closest group home for each candidate
  const enrichedCandidates = useMemo(() => {
    return candidates.map((candidate) => {
      const cleanZip = normalizeZipCode(candidate.zip_code);

      if (selectedHome) {
        // Distance specifically to selected group home
        const dist = cleanZip ? calculateDistanceMiles(cleanZip, selectedHome.zip_code) : null;
        const commute = calculateCommuteMinutes(dist);
        return {
          candidate,
          cleanZip,
          matchedHome: selectedHome,
          distanceMiles: dist,
          commuteMinutes: commute,
        };
      } else {
        // Distance to closest group home
        const closest = cleanZip ? findClosestGroupHome(cleanZip, groupHomes) : null;
        return {
          candidate,
          cleanZip,
          matchedHome: closest ? closest.home : null,
          distanceMiles: closest?.distanceMiles ?? null,
          commuteMinutes: closest?.commuteMinutes ?? null,
        };
      }
    });
  }, [candidates, groupHomes, selectedHome]);

  // Filter candidates according to user criteria
  const filteredCandidates = useMemo(() => {
    return enrichedCandidates.filter((item) => {
      const c = item.candidate;

      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
        const email = (c.email || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const zip = (c.zip_code || "").toLowerCase();
        const address = (c.address || "").toLowerCase();
        const skills = (c.primary_skills || "").toLowerCase();
        const homeName = item.matchedHome ? item.matchedHome.name.toLowerCase() : "";

        if (
          !fullName.includes(query) &&
          !email.includes(query) &&
          !phone.includes(query) &&
          !zip.includes(query) &&
          !address.includes(query) &&
          !skills.includes(query) &&
          !homeName.includes(query)
        ) {
          return false;
        }
      }

      // 2. Radius Filter
      if (selectedRadius !== "any") {
        if (item.distanceMiles === null || item.distanceMiles > selectedRadius) {
          return false;
        }
      }

      // 3. Shift Preference Filter (Candidate must support at least one of selected shifts)
      if (selectedShifts.length > 0) {
        const candidateShifts = c.shift_preferences || [];
        const hasMatchingShift = selectedShifts.some((s) => candidateShifts.includes(s));
        if (!hasMatchingShift) {
          return false;
        }
      }

      // 4. Pipeline Stage Filter
      if (selectedStage !== "all") {
        if (c.pipeline_stage !== selectedStage) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedCandidates, searchQuery, selectedRadius, selectedShifts, selectedStage]);

  // Sort candidates
  const sortedCandidates = useMemo(() => {
    return [...filteredCandidates].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "distance") {
        const distA = a.distanceMiles ?? 9999;
        const distB = b.distanceMiles ?? 9999;
        comparison = distA - distB;
      } else if (sortBy === "commute") {
        const commA = a.commuteMinutes ?? 9999;
        const commB = b.commuteMinutes ?? 9999;
        comparison = commA - commB;
      } else if (sortBy === "name") {
        const nameA = `${a.candidate.last_name} ${a.candidate.first_name}`.toLowerCase();
        const nameB = `${b.candidate.last_name} ${b.candidate.first_name}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === "recent") {
        const dateA = new Date(a.candidate.created_at).getTime();
        const dateB = new Date(b.candidate.created_at).getTime();
        comparison = dateB - dateA;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredCandidates, sortBy, sortDirection]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = enrichedCandidates.length;
    const withinRadiusCount = filteredCandidates.length;

    let daysCount = 0;
    let eveningsCount = 0;
    let nightsCount = 0;
    let unspecifiedShiftsCount = 0;

    filteredCandidates.forEach((item) => {
      const shifts = item.candidate.shift_preferences || [];
      if (shifts.includes("Days")) daysCount++;
      if (shifts.includes("Evenings")) eveningsCount++;
      if (shifts.includes("Nights")) nightsCount++;
      if (shifts.length === 0) unspecifiedShiftsCount++;
    });

    const validCommutes = filteredCandidates
      .map((i) => i.commuteMinutes)
      .filter((m): m is number => m !== null);
    const avgCommute = validCommutes.length > 0
      ? Math.round(validCommutes.reduce((sum, v) => sum + v, 0) / validCommutes.length)
      : null;

    return {
      total,
      withinRadiusCount,
      daysCount,
      eveningsCount,
      nightsCount,
      unspecifiedShiftsCount,
      avgCommute,
    };
  }, [enrichedCandidates, filteredCandidates]);

  function handleShiftToggle(shift: ShiftPreference) {
    setSelectedShifts((prev) =>
      prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift]
    );
  }

  function toggleSort(field: "distance" | "commute" | "name" | "recent") {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  }

  function getProximityBadge(miles: number | null) {
    if (miles === null || miles === undefined) {
      return { label: "No ZIP", color: "bg-slate-100 text-slate-500 border-slate-200" };
    }
    if (miles <= 5) {
      return { label: "≤ 5 mi (Local)", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (miles <= 10) {
      return { label: "≤ 10 mi (Ideal)", color: "bg-sky-50 text-sky-700 border-sky-200" };
    }
    if (miles <= 18) {
      return { label: "≤ 18 mi (Moderate)", color: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    return { label: "> 18 mi (Long)", color: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  return (
    <div className="flex h-full flex-col space-y-5">
      {/* Top Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white shadow-2xs">
                <MapPin className="h-4 w-4" />
              </span>
              DSP Lead Matching & Proximity
            </h2>
            <span className="rounded-full bg-sky-100 text-sky-800 px-2.5 py-0.5 text-xs font-bold border border-sky-200">
              Offline Geo Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Zero-cost geographic matching across all 15 Reliance group homes with shift availability filters.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-sky-600" : ""}`} />
          <span>{loading ? "Refreshing..." : "Refresh Leads"}</span>
        </button>
      </div>

      {/* Top Stat Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            Total DSP Leads
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">In recruiting pool</div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 flex items-center gap-1">
            <Car className="h-3.5 w-3.5 text-sky-600" />
            Within Radius
          </div>
          <div className="mt-1 text-2xl font-black text-sky-950">
            {stats.withinRadiusCount}
          </div>
          <div className="text-[11px] text-sky-700/80 mt-0.5">
            {selectedRadius === "any" ? "Any distance" : `≤ ${selectedRadius} miles`}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
            <span>☀️</span> Days Shift
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-950">{stats.daysCount}</div>
          <div className="text-[11px] text-emerald-700/80 mt-0.5">Candidates available</div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1">
            <span>🌆</span> Evenings
          </div>
          <div className="mt-1 text-2xl font-black text-amber-950">{stats.eveningsCount}</div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">Candidates available</div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800 flex items-center gap-1">
            <span>🌙</span> Nights
          </div>
          <div className="mt-1 text-2xl font-black text-indigo-950">{stats.nightsCount}</div>
          <div className="text-[11px] text-indigo-700/80 mt-0.5">Overnight / awake</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Avg. Commute
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {stats.avgCommute !== null ? `~${stats.avgCommute}m` : "—"}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Suburban factor 1.8x</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search bar */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name, phone, ZIP, skills..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Group Home Dropdown */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={selectedHomeId}
                onChange={(e) => setSelectedHomeId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">📍 All 15 Group Homes (Rank by Closest)</option>
                {groupHomes.map((home) => (
                  <option key={home.id} value={home.id}>
                    {home.name} — {home.address}, {home.city} {home.zip_code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Radius Selector */}
          <div className="md:col-span-2">
            <select
              value={String(selectedRadius)}
              onChange={(e) =>
                setSelectedRadius(e.target.value === "any" ? "any" : Number(e.target.value))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            >
              <option value="5">Within 5 miles</option>
              <option value="10">Within 10 miles</option>
              <option value="15">Within 15 miles</option>
              <option value="25">Within 25 miles</option>
              <option value="any">Any Distance</option>
            </select>
          </div>

          {/* Pipeline Stage Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Stages</option>
              <option value="new_application">New Application</option>
              <option value="screening">Screening</option>
              <option value="interview">Interview</option>
              <option value="completing_requirements">Completing Requirements</option>
              <option value="offer">Offer</option>
              <option value="background_checks">Background Checks</option>
              <option value="hired">Hired</option>
              <option value="disqualified">Rejected</option>
            </select>
          </div>
        </div>

        {/* Second Row: Shift Preferences Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              Filter by Available Shifts:
            </span>
            {SHIFT_OPTIONS.map((shift) => {
              const isSelected = selectedShifts.includes(shift.id);
              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => handleShiftToggle(shift.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer border shadow-2xs ${
                    isSelected
                      ? "bg-sky-600 text-white border-sky-600 ring-2 ring-sky-600/20"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>{shift.icon}</span>
                  <span>{shift.label}</span>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </button>
              );
            })}
            {selectedShifts.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedShifts([])}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
              >
                Clear shifts
              </button>
            )}
          </div>

          {/* Active Filter Summary */}
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{sortedCandidates.length}</strong> matching candidates
          </div>
        </div>
      </div>

      {/* Sortable Leads Table */}
      <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-200">
            <thead className="bg-slate-50 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th
                  onClick={() => toggleSort("name")}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Candidate</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">ZIP / Location</th>
                <th className="py-3 px-4">Target Group Home</th>
                <th
                  onClick={() => toggleSort("distance")}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Distance</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("commute")}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Est. Commute</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Shift Preferences</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-sky-600 mb-2" />
                    Calculating commute math and matching group homes...
                  </td>
                </tr>
              ) : sortedCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <MapPin className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No candidates match your filters.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try expanding the search radius or clearing specific shift filters.
                    </p>
                  </td>
                </tr>
              ) : (
                sortedCandidates.map(({ candidate, matchedHome, distanceMiles, commuteMinutes }) => {
                  const stageInfo = STAGE_CONFIG[candidate.pipeline_stage] || {
                    label: candidate.pipeline_stage,
                    color: "bg-slate-100 text-slate-700 border-slate-200",
                  };
                  const proxBadge = getProximityBadge(distanceMiles);

                  return (
                    <tr
                      key={candidate.id}
                      onClick={() => setDrawerCandidate(candidate)}
                      className="hover:bg-sky-50/40 cursor-pointer transition"
                    >
                      {/* Candidate Name & Role */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          {candidate.first_name} {candidate.last_name}
                          {candidate.dnh_flag && (
                            <span className="rounded bg-red-100 text-red-700 border border-red-200 text-[10px] px-1.5 py-0.2 font-bold">
                              DNH
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {candidate.jobs?.title || "Direct Support Professional"}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {candidate.phone || candidate.email || "No contact"}
                        </div>
                      </td>

                      {/* Stage Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${stageInfo.color}`}
                        >
                          {stageInfo.label}
                        </span>
                      </td>

                      {/* ZIP / Location */}
                      <td className="py-3 px-4">
                        {candidate.zip_code ? (
                          <div>
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-sky-600" />
                              {candidate.zip_code}
                            </span>
                            {candidate.address && (
                              <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                                {candidate.address}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="rounded bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                            ZIP Missing
                          </span>
                        )}
                      </td>

                      {/* Target Group Home */}
                      <td className="py-3 px-4">
                        {matchedHome ? (
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              {matchedHome.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {matchedHome.address}, {matchedHome.city}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">No home matched</span>
                        )}
                      </td>

                      {/* Distance */}
                      <td className="py-3 px-4">
                        {distanceMiles !== null ? (
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">
                              {distanceMiles} mi
                            </div>
                            <span
                              className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-medium border ${proxBadge.color}`}
                            >
                              {proxBadge.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Commute Duration */}
                      <td className="py-3 px-4">
                        {commuteMinutes !== null ? (
                          <div className="flex items-center gap-1 font-semibold text-slate-800">
                            <Car className="h-3.5 w-3.5 text-sky-600" />
                            ~{commuteMinutes} min
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Shift Preferences */}
                      <td className="py-3 px-4">
                        {candidate.shift_preferences && candidate.shift_preferences.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {candidate.shift_preferences.map((shift) => (
                              <span
                                key={shift}
                                className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-semibold border border-slate-200"
                              >
                                <span>
                                  {shift === "Days" ? "☀️" : shift === "Evenings" ? "🌆" : "🌙"}
                                </span>
                                <span>{shift}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unspecified</span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setDrawerCandidate(candidate)}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-sky-600 hover:text-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
                        >
                          <span>Open Drawer</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Candidate Drawer */}
      {drawerCandidate && (
        <CandidateDetailDrawer
          candidate={drawerCandidate}
          onClose={() => setDrawerCandidate(null)}
          onCandidateUpdated={(updated) => {
            setCandidates((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
            );
            setDrawerCandidate(updated);
          }}
          onStageChange={(cand, newStage) => {
            setCandidates((prev) =>
              prev.map((c) => (c.id === cand.id ? { ...c, pipeline_stage: newStage } : c))
            );
            setDrawerCandidate((prev) => (prev ? { ...prev, pipeline_stage: newStage } : prev));
          }}
        />
      )}
    </div>
  );
}
