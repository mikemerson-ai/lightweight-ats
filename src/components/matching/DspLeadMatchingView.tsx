"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Car,
  Clock,
  Search,
  Users,
  Building2,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  Check,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Phone,
  Mail,
  Compass,
} from "lucide-react";
import type { Candidate } from "@/app/actions/candidates";
import { getDspCandidates } from "@/app/actions/candidates";
import { getCandidateRole } from "@/lib/constants";
import type { GroupHome } from "@/types/groupHomes";
import { SHIFT_OPTIONS, AVAILABILITY_DAYS_OPTIONS, type ShiftPreference } from "@/types/groupHomes";
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
  reviewing: { label: "Reviewing", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  screening: { label: "Screening", color: "bg-purple-50 text-purple-700 border-purple-200" },
  interview: { label: "Interview", color: "bg-amber-50 text-amber-700 border-amber-200" },
  completing_requirements: { label: "Requirements", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  offer: { label: "Offer", color: "bg-teal-50 text-teal-700 border-teal-200" },
  background_checks: { label: "Background", color: "bg-orange-50 text-orange-700 border-orange-200" },
  hired: { label: "Hired", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  disqualified: { label: "Rejected", color: "bg-rose-50 text-rose-700 border-rose-200" },
};

interface EnrichedCandidate {
  candidate: Candidate;
  distanceMiles: number | null;
  commuteMinutes: number | null;
  matchedHome: GroupHome | null;
  isAllHomesRanking: boolean;
}

export function DspLeadMatchingView() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [groupHomes, setGroupHomes] = useState<GroupHome[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedHomeId, setSelectedHomeId] = useState<string>("all");
  const [selectedRadius, setSelectedRadius] = useState<number | "any">(10);
  const [selectedShifts, setSelectedShifts] = useState<ShiftPreference[]>([]);
  const [selectedAvailabilityDays, setSelectedAvailabilityDays] = useState<string[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedTemperature, setSelectedTemperature] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<"all" | "dsp" | "hha">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState<"distance" | "commute" | "name" | "recent">("distance");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Drawer
  const [drawerCandidate, setDrawerCandidate] = useState<Candidate | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [candData, homesData] = await Promise.all([
        getDspCandidates(),
        getGroupHomes(),
      ]);
      setCandidates(candData);
      setGroupHomes(homesData);
    } catch (err) {
      console.error("Failed to load DSP lead matching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedHome = useMemo(() => {
    if (selectedHomeId === "all") return null;
    return groupHomes.find((h) => h.id === selectedHomeId) || null;
  }, [selectedHomeId, groupHomes]);

  // Enrich candidates with commute & distance calculations
  const enrichedCandidates = useMemo<EnrichedCandidate[]>(() => {
    if (groupHomes.length === 0) {
      return candidates.map((c) => ({
        candidate: c,
        distanceMiles: null,
        commuteMinutes: null,
        matchedHome: null,
        isAllHomesRanking: false,
      }));
    }

    return candidates.map((candidate) => {
      const candidateZip = normalizeZipCode(candidate.zip_code);

      if (selectedHome) {
        if (!candidateZip) {
          return {
            candidate,
            distanceMiles: null,
            commuteMinutes: null,
            matchedHome: selectedHome,
            isAllHomesRanking: false,
          };
        }
        const dist = calculateDistanceMiles(candidateZip, selectedHome.zip_code);
        const commute = calculateCommuteMinutes(dist);
        return {
          candidate,
          distanceMiles: dist,
          commuteMinutes: commute,
          matchedHome: selectedHome,
          isAllHomesRanking: false,
        };
      } else {
        if (!candidateZip) {
          return {
            candidate,
            distanceMiles: null,
            commuteMinutes: null,
            matchedHome: null,
            isAllHomesRanking: true,
          };
        }
        const closest = findClosestGroupHome(candidateZip, groupHomes);
        return {
          candidate,
          distanceMiles: closest?.distanceMiles ?? null,
          commuteMinutes: closest?.commuteMinutes ?? null,
          matchedHome: closest?.home ?? null,
          isAllHomesRanking: true,
        };
      }
    });
  }, [candidates, groupHomes, selectedHome]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return enrichedCandidates.filter((item) => {
      const c = item.candidate;

      // Stage filter
      if (selectedStage !== "all" && c.pipeline_stage !== selectedStage) {
        return false;
      }

      // Role filter
      if (selectedRole !== "all") {
        const role = getCandidateRole(c.jobs?.title);
        if (role !== selectedRole) return false;
      }

      // Temperature filter
      if (selectedTemperature !== "all") {
        if (selectedTemperature === "unset") {
          if (c.temperature) return false;
        } else {
          if (c.temperature !== selectedTemperature) return false;
        }
      }

      // Radius filter
      if (selectedRadius !== "any") {
        if (item.distanceMiles === null) return false;
        if (item.distanceMiles > selectedRadius) return false;
      }

      // Shifts filter
      if (selectedShifts.length > 0) {
        const candidateShifts = c.shift_preferences || [];
        const hasMatch = selectedShifts.some((s) => candidateShifts.includes(s));
        if (!hasMatch) return false;
      }

      // Availability Days filter
      if (selectedAvailabilityDays.length > 0) {
        const candidateDays = c.availability_days || [];
        const hasMatch = selectedAvailabilityDays.some((d) => candidateDays.includes(d));
        if (!hasMatch) return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
        const skills = (c.primary_skills || "").toLowerCase();
        const zip = (c.zip_code || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const homeName = item.matchedHome?.name.toLowerCase() || "";

        if (
          !fullName.includes(q) &&
          !skills.includes(q) &&
          !zip.includes(q) &&
          !email.includes(q) &&
          !phone.includes(q) &&
          !homeName.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedCandidates, selectedStage, selectedTemperature, selectedRadius, selectedShifts, selectedAvailabilityDays, searchQuery, selectedRole]);

  // Sort candidates
  const sortedCandidates = useMemo(() => {
    const list = [...filteredCandidates];

    list.sort((a, b) => {
      let comparison = 0;

      if (sortBy === "distance") {
        if (a.distanceMiles === null && b.distanceMiles === null) comparison = 0;
        else if (a.distanceMiles === null) comparison = 1;
        else if (b.distanceMiles === null) comparison = -1;
        else comparison = a.distanceMiles - b.distanceMiles;
      } else if (sortBy === "commute") {
        if (a.commuteMinutes === null && b.commuteMinutes === null) comparison = 0;
        else if (a.commuteMinutes === null) comparison = 1;
        else if (b.commuteMinutes === null) comparison = -1;
        else comparison = a.commuteMinutes - b.commuteMinutes;
      } else if (sortBy === "name") {
        const nameA = `${a.candidate.last_name} ${a.candidate.first_name}`.toLowerCase();
        const nameB = `${b.candidate.last_name} ${b.candidate.first_name}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === "recent") {
        const dateA = new Date(a.candidate.created_at || 0).getTime();
        const dateB = new Date(b.candidate.created_at || 0).getTime();
        comparison = dateB - dateA;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [filteredCandidates, sortBy, sortDirection]);

  // Quick stats
  const stats = useMemo(() => {
    const total = candidates.length;
    const withinRadiusCount = filteredCandidates.length;

    let daysCount = 0;
    let eveningsCount = 0;
    let nightsCount = 0;

    filteredCandidates.forEach((item) => {
      const shifts = item.candidate.shift_preferences || [];
      if (shifts.includes("Days")) daysCount++;
      if (shifts.includes("Evenings")) eveningsCount++;
      if (shifts.includes("Nights")) nightsCount++;
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
      avgCommute,
    };
  }, [candidates, filteredCandidates]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedHomeId !== "all") count++;
    if (selectedRadius !== "any") count++;
    if (selectedShifts.length > 0) count += selectedShifts.length;
    if (selectedStage !== "all") count++;
    if (searchQuery.trim()) count++;
    if (selectedRole !== "all") count++;
    return count;
  }, [selectedHomeId, selectedRadius, selectedShifts, selectedStage, searchQuery, selectedRole]);

  function resetAllFilters() {
    setSelectedHomeId("all");
    setSelectedRadius("any");
    setSelectedShifts([]);
    setSelectedStage("all");
    setSearchQuery("");
    setSelectedRole("all");
  }

  const handleShiftToggle = (shift: ShiftPreference) => {
    setSelectedShifts((prev) =>
      prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift]
    );
  };

  const handleAvailabilityDayToggle = (day: string) => {
    setSelectedAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

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
      return { label: `≤ 5 mi (Local)`, color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (miles <= 10) {
      return { label: `≤ 10 mi (Ideal)`, color: "bg-sky-50 text-sky-700 border-sky-200" };
    }
    if (miles <= 18) {
      return { label: `≤ 18 mi (Moderate)`, color: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    return { label: `> 18 mi (Long)`, color: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* View Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs shrink-0">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                DSP Proximity & Shift Matching
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 px-2 py-0.5 text-[11px] font-bold border border-sky-200/60">
                <Sparkles className="w-3 h-3 text-sky-500" />
                Offline Proximity Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live distance calculations across 15 group homes with zero external API fees
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              <span>Reset Filters ({activeFiltersCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-sky-600" : "text-slate-400"}`} />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Interactive KPI & Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Candidates Card */}
        <div
          onClick={resetAllFilters}
          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
          title="Click to reset filters and view all candidates"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              Total Leads
            </span>
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900 group-hover:text-primary transition-colors">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">DSP & HHA roles only</div>
        </div>

        {/* Within Radius Filter Card */}
        <div
          onClick={() => setSelectedRadius((prev) => (prev === 10 ? "any" : 10))}
          className={`rounded-xl border p-3.5 shadow-2xs transition-all cursor-pointer ${
            selectedRadius !== "any"
              ? "border-sky-300 bg-sky-50/70 ring-2 ring-sky-500/20"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
          title="Click to toggle 10-mile radius filter"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Car className="h-3.5 w-3.5 text-sky-600" />
              Radius Match
            </span>
            {selectedRadius !== "any" && (
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            )}
          </div>
          <div className="mt-1 text-2xl font-black text-sky-950">
            {stats.withinRadiusCount}
          </div>
          <div className="text-[11px] text-sky-700 font-medium mt-0.5 truncate">
            {selectedRadius === "any" ? "Any radius" : `≤ ${selectedRadius} mi radius`}
          </div>
        </div>

        {/* Days Shift Card */}
        <div
          onClick={() => handleShiftToggle("Days")}
          className={`rounded-xl border p-3.5 shadow-2xs transition-all cursor-pointer ${
            selectedShifts.includes("Days")
              ? "border-emerald-300 bg-emerald-50/70 ring-2 ring-emerald-500/20"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
          title="Click to toggle Days shift filter"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>☀️</span> Days Shift
            </span>
            {selectedShifts.includes("Days") && (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            )}
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-950">{stats.daysCount}</div>
          <div className="text-[11px] text-emerald-700/80 font-medium mt-0.5 truncate">
            {selectedShifts.includes("Days") ? "Active filter" : "Click to filter"}
          </div>
        </div>

        {/* Evenings Shift Card */}
        <div
          onClick={() => handleShiftToggle("Evenings")}
          className={`rounded-xl border p-3.5 shadow-2xs transition-all cursor-pointer ${
            selectedShifts.includes("Evenings")
              ? "border-amber-300 bg-amber-50/70 ring-2 ring-amber-500/20"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
          title="Click to toggle Evenings shift filter"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>🌆</span> Evenings
            </span>
            {selectedShifts.includes("Evenings") && (
              <Check className="h-3.5 w-3.5 text-amber-600" />
            )}
          </div>
          <div className="mt-1 text-2xl font-black text-amber-950">{stats.eveningsCount}</div>
          <div className="text-[11px] text-amber-700/80 font-medium mt-0.5 truncate">
            {selectedShifts.includes("Evenings") ? "Active filter" : "Click to filter"}
          </div>
        </div>

        {/* Nights Shift Card */}
        <div
          onClick={() => handleShiftToggle("Nights")}
          className={`rounded-xl border p-3.5 shadow-2xs transition-all cursor-pointer ${
            selectedShifts.includes("Nights")
              ? "border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-500/20"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
          title="Click to toggle Nights shift filter"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>🌙</span> Nights
            </span>
            {selectedShifts.includes("Nights") && (
              <Check className="h-3.5 w-3.5 text-indigo-600" />
            )}
          </div>
          <div className="mt-1 text-2xl font-black text-indigo-950">{stats.nightsCount}</div>
          <div className="text-[11px] text-indigo-700/80 font-medium mt-0.5 truncate">
            {selectedShifts.includes("Nights") ? "Active filter" : "Click to filter"}
          </div>
        </div>

        {/* Avg. Commute Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Avg. Commute
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {stats.avgCommute !== null ? `~${stats.avgCommute}m` : "—"}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">Suburban transit model</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search bar */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, skills, ZIP code, or group home..."
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
                    {home.name} — {home.address} ({home.zip_code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Radius Selector */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-1.5">
              <Car className="h-4 w-4 text-slate-400 shrink-0" />
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
          </div>

          {/* Pipeline Stage Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Pipeline Stages</option>
              <option value="new_application">New Application</option>
              <option value="reviewing">Reviewing</option>
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

        {/* Second Row: Radius Preset Pills & Shift Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          
          {/* Role Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 mr-1">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              Role:
            </span>
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedRole("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  selectedRole === "all"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent"
                }`}
              >
                Both
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole("dsp")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  selectedRole === "dsp"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent"
                }`}
              >
                DSP
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole("hha")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  selectedRole === "hha"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent"
                }`}
              >
                HHA
              </button>
            </div>
          </div>

          {/* Shift Preferences Pills */}
          <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 mr-1">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              Shifts:
            </span>
            {SHIFT_OPTIONS.map((shift) => {
              const isSelected = selectedShifts.includes(shift.id);
              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => handleShiftToggle(shift.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition cursor-pointer border shadow-2xs ${
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
          </div>

          {/* Availability Days Pills */}
          <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 mr-1">
              Days:
            </span>
            {AVAILABILITY_DAYS_OPTIONS.map((day) => {
              const isSelected = selectedAvailabilityDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => handleAvailabilityDayToggle(day.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition cursor-pointer border shadow-2xs ${
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-600/20"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>{day.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Radius Pills */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-600 mr-1">Radius:</span>
            {[5, 10, 15, "any"].map((r) => {
              const active = selectedRadius === r;
              return (
                <button
                  key={String(r)}
                  type="button"
                  onClick={() => setSelectedRadius(r as number | "any")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
                    active
                      ? "bg-sky-50 text-sky-700 border-sky-300 font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {r === "any" ? "Any" : `≤ ${r} mi`}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-xs font-semibold text-slate-600">Temp:</span>
            <select
              value={selectedTemperature}
              onChange={(e) => setSelectedTemperature(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
            >
              <option value="all">All Temps</option>
              <option value="hot">🔥 Hot</option>
              <option value="warm">☀️ Warm</option>
              <option value="cold">❄️ Cold</option>
              <option value="unset">Unassigned</option>
            </select>
          </div>
        </div>

        {/* Selected Home Context Notification (if a specific home is selected) */}
        {selectedHome && (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-sky-50/70 border border-sky-200/80 text-xs text-sky-900">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-sky-600 shrink-0" />
              <span>
                Matching specifically for: <strong>{selectedHome.name}</strong> ({selectedHome.address}, {selectedHome.city} {selectedHome.zip_code})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedHomeId("all")}
              className="text-sky-700 hover:text-sky-900 underline font-semibold text-[11px] cursor-pointer"
            >
              Show all homes
            </button>
          </div>
        )}
      </div>

      {/* Sortable Leads Table */}
      <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden flex flex-col min-h-[400px]">
        {/* Table summary bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{sortedCandidates.length}</strong> matching candidates
          </div>
          <div className="flex items-center gap-3">
            <span>Sort by:</span>
            <button
              type="button"
              onClick={() => toggleSort("distance")}
              className={`font-medium hover:text-slate-900 cursor-pointer ${sortBy === "distance" ? "text-sky-600 font-bold" : ""}`}
            >
              Distance {sortBy === "distance" && (sortDirection === "asc" ? "↑" : "↓")}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("commute")}
              className={`font-medium hover:text-slate-900 cursor-pointer ${sortBy === "commute" ? "text-sky-600 font-bold" : ""}`}
            >
              Commute {sortBy === "commute" && (sortDirection === "asc" ? "↑" : "↓")}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("name")}
              className={`font-medium hover:text-slate-900 cursor-pointer ${sortBy === "name" ? "text-sky-600 font-bold" : ""}`}
            >
              Name {sortBy === "name" && (sortDirection === "asc" ? "↑" : "↓")}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-200">
            <thead className="bg-slate-50/80 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
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
                <th className="py-3 px-4">Candidate Location</th>
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
                <th className="py-3 px-4">Shifts & Days</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-sky-600 mb-2" />
                    Calculating proximity math and ranking DSP candidates...
                  </td>
                </tr>
              ) : sortedCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <MapPin className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700 text-sm">No candidates match your filters.</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Try expanding the distance radius or clearing specific shift preference filters.
                    </p>
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-semibold transition cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset All Filters</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                sortedCandidates.map((item) => {
                  const candidate = item.candidate;
                  const stage = STAGE_CONFIG[candidate.pipeline_stage] || {
                    label: candidate.pipeline_stage,
                    color: "bg-slate-100 text-slate-700 border-slate-200",
                  };
                  const proxBadge = getProximityBadge(item.distanceMiles);
                  const shifts = candidate.shift_preferences || [];
                  const days = candidate.availability_days || [];
                  const initials = `${(candidate.first_name || "")[0] || ""}${(candidate.last_name || "")[0] || ""}`.toUpperCase();

                  return (
                    <tr
                      key={candidate.id}
                      onClick={() => setDrawerCandidate(candidate)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      {/* Candidate Name & Contact */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-sky-100 group-hover:text-sky-800 transition-colors shadow-2xs">
                            {initials || "C"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors flex items-center gap-1.5">
                              {candidate.first_name} {candidate.last_name}
                              {candidate.temperature === 'hot' && <span className="text-xs" title="Hot Lead">🔥</span>}
                              {candidate.temperature === 'warm' && <span className="text-xs" title="Warm Lead">☀️</span>}
                              {candidate.temperature === 'cold' && <span className="text-xs" title="Cold Lead">❄️</span>}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              {candidate.phone && (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="h-3 w-3" />
                                  {candidate.phone}
                                </span>
                              )}
                              {candidate.email && (
                                <span className="flex items-center gap-0.5 truncate max-w-[140px]">
                                  <Mail className="h-3 w-3" />
                                  {candidate.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Stage Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${stage.color}`}
                        >
                          {stage.label}
                        </span>
                      </td>

                      {/* Candidate Location */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {candidate.zip_code ? (
                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                              {candidate.zip_code}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No ZIP set</span>
                          )}
                        </div>
                        {candidate.address && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                            {candidate.address}
                          </div>
                        )}
                      </td>

                      {/* Target Group Home */}
                      <td className="py-3 px-4">
                        {item.matchedHome ? (
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                              <span>{item.matchedHome.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {item.matchedHome.address} ({item.matchedHome.zip_code})
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Distance Badge */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${proxBadge.color}`}
                          >
                            <MapPin className="h-3 w-3" />
                            {item.distanceMiles !== null ? `${item.distanceMiles} miles` : "—"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {proxBadge.label}
                          </span>
                        </div>
                      </td>

                      {/* Commute Time */}
                      <td className="py-3 px-4">
                        {item.commuteMinutes !== null ? (
                          <div className="flex items-center gap-1 font-semibold text-slate-800">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>~{item.commuteMinutes} mins</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Shifts & Days Preferences */}
                      <td className="py-3 px-4">
                        {shifts.length === 0 && days.length === 0 ? (
                          <span className="text-slate-400 text-[11px] italic">Not specified</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {shifts.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {shifts.map((s) => {
                                  const isDays = s === "Days";
                                  const isEvenings = s === "Evenings";
                                  const isNights = s === "Nights";

                                  const color = isDays
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : isEvenings
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : isNights
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : "bg-slate-50 text-slate-700 border-slate-200";

                                  const icon = isDays ? "☀️" : isEvenings ? "🌆" : isNights ? "🌙" : "•";

                                  return (
                                    <span
                                      key={s}
                                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${color}`}
                                    >
                                      <span>{icon}</span>
                                      <span>{s}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {days.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {days.map((d) => (
                                  <span
                                    key={d}
                                    className="inline-flex items-center justify-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                                    title={`Available on ${d}`}
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setDrawerCandidate(candidate)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-sky-600 hover:text-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
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

export default DspLeadMatchingView;
