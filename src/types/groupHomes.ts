export type ShiftPreference = "Days" | "Evenings" | "Nights";

export const SHIFT_OPTIONS: { id: ShiftPreference; label: string; icon: string }[] = [
  { id: "Days", label: "Days", icon: "☀️" },
  { id: "Evenings", label: "Evenings", icon: "🌆" },
  { id: "Nights", label: "Nights", icon: "🌙" },
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
