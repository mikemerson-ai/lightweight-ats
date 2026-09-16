export type ShiftPreference = "Days" | "Evenings" | "Nights";

export const SHIFT_OPTIONS: { id: ShiftPreference; label: string; icon: string }[] = [
  { id: "Days", label: "Days", icon: "☀️" },
  { id: "Evenings", label: "Evenings", icon: "🌆" },
  { id: "Nights", label: "Nights", icon: "🌙" },
];

export const AVAILABILITY_DAYS_OPTIONS = [
  { id: "Su", label: "Su" },
  { id: "M", label: "M" },
  { id: "Tu", label: "Tu" },
  { id: "W", label: "W" },
  { id: "Th", label: "Th" },
  { id: "F", label: "F" },
  { id: "Sa", label: "Sa" },
];

export interface GroupHome {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GroupHomeProximity {
  home: GroupHome;
  distanceMiles: number;
  commuteMinutes: number;
}
