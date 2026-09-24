export type ShiftPreference = "Days" | "Evenings" | "Nights";

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

/**
 * Hardcoded list of Reliance group homes used as a client-side fallback
 * when the server action fails (e.g., Vercel cold starts, network errors).
 * This is safe to import from client components because it contains no server-only APIs.
 */
export const DEFAULT_GROUP_HOMES: GroupHome[] = [
  { id: "gh-1", name: "60th St", address: "1711 North 60th Street", city: "Philadelphia", state: "PA", zip_code: "19151", is_active: true },
  { id: "gh-2", name: "Carrol St", address: "2526 Carrol St", city: "Philadelphia", state: "PA", zip_code: "19142", is_active: true },
  { id: "gh-3", name: "Muhfeld St", address: "2607 S Muhfeld St", city: "Philadelphia", state: "PA", zip_code: "19142", is_active: true },
  { id: "gh-4", name: "Wyalusing Ave", address: "5333 Wyalusing Avenue", city: "Philadelphia", state: "PA", zip_code: "19131", is_active: true },
  { id: "gh-5", name: "Buist Ave", address: "7533 Buist Ave", city: "Philadelphia", state: "PA", zip_code: "19153", is_active: true },
  { id: "gh-6", name: "Lindbergh Apt 113", address: "7701 Lindbergh Blvd Apt 113", city: "Philadelphia", state: "PA", zip_code: "19153", is_active: true },
  { id: "gh-7", name: "Lindbergh Apt 1509", address: "7833 Lindbergh Blvd Apt 1509", city: "Philadelphia", state: "PA", zip_code: "19153", is_active: true },
  { id: "gh-8", name: "Lindbergh Apt 804", address: "8400 Lindbergh Blvd Apt 804", city: "Philadelphia", state: "PA", zip_code: "19153", is_active: true },
  { id: "gh-9", name: "Apt 1005 Lindbergh", address: "8402 Madison Pl Apt 1005", city: "Philadelphia", state: "PA", zip_code: "19153", is_active: true },
  { id: "gh-10", name: "Hobart St", address: "2220 N Hobart St", city: "Philadelphia", state: "PA", zip_code: "19131", is_active: true },
  { id: "gh-11", name: "Ivy Hill Rd", address: "1000 Ivy Hill Rd", city: "Philadelphia", state: "PA", zip_code: "19150", is_active: true },
  { id: "gh-12", name: "Frankford Ave", address: "8216 Frankford Ave", city: "Philadelphia", state: "PA", zip_code: "19136", is_active: true },
  { id: "gh-13", name: "Indian Park", address: "64 Indian Park Rd", city: "Levittown", state: "PA", zip_code: "19057", is_active: true },
  { id: "gh-14", name: "Winder Dr", address: "806 Winder Dr", city: "Bristol", state: "PA", zip_code: "19007", is_active: true },
  { id: "gh-15", name: "RFC Office", address: "1700 S 60th St", city: "Philadelphia", state: "PA", zip_code: "19142", is_active: true },
];

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
