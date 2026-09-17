import zipcodes from "zipcodes";
import type { GroupHome, GroupHomeProximity } from "@/types/groupHomes";

/**
 * Normalizes any zip code input to a clean 5-digit US postal code string.
 * Handles ZIP+4 formats (e.g., "19151-1234") and strings containing addresses.
 */
export function normalizeZipCode(zip: string | number | null | undefined): string | null {
  if (!zip) return null;
  const str = String(zip).trim();
  const match = str.match(/\b\d{5}\b/);
  return match ? match[0] : null;
}

/**
 * Programmatically extracts a US postal code from a free-form address string.
 * Supports both 5-digit and ZIP+4 formats (e.g., "19124" or "19124-1234").
 */
export function extractZipCode(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = String(address).match(/\b\d{5}(?:-\d{4})?\b/);
  return match ? match[0] : null;
}

/**
 * Haversine formula calculation in miles between two latitude/longitude points.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Calculates in-memory distance in miles between two US postal codes.
 * Returns null if either zip code cannot be resolved.
 */
export function calculateDistanceMiles(
  zipA: string | number | null | undefined,
  zipB: string | number | null | undefined,
): number | null {
  const cleanA = normalizeZipCode(zipA);
  const cleanB = normalizeZipCode(zipB);

  if (!cleanA || !cleanB) return null;
  if (cleanA === cleanB) return 0;

  try {
    const dist = zipcodes.distance(cleanA, cleanB);
    if (dist !== null && dist !== undefined && !isNaN(dist)) {
      return Math.round(dist * 10) / 10;
    }

    // Fallback: lookup coordinates manually
    const locA = zipcodes.lookup(cleanA);
    const locB = zipcodes.lookup(cleanB);
    if (locA?.latitude && locA?.longitude && locB?.latitude && locB?.longitude) {
      return haversineDistance(locA.latitude, locA.longitude, locB.latitude, locB.longitude);
    }
  } catch {
    // Ignore error and return null
  }

  return null;
}

/**
 * Calculates estimated driving commute in minutes using the 1.8x suburban transit factor.
 * Formula: distanceMiles * 1.8, rounded to nearest whole minute.
 */
export function calculateCommuteMinutes(
  distanceMiles: number | null | undefined,
): number | null {
  if (distanceMiles === null || distanceMiles === undefined || isNaN(distanceMiles)) {
    return null;
  }
  if (distanceMiles <= 0) return 5; // Local neighborhood / same zip transit
  return Math.max(5, Math.round(distanceMiles * 1.8));
}

/**
 * Returns geographic details (city, state, coordinates) for a given zip code.
 */
export function lookupZipDetails(zip: string | number | null | undefined) {
  const clean = normalizeZipCode(zip);
  if (!clean) return null;
  const info = zipcodes.lookup(clean);
  if (!info) return null;
  return {
    zip: clean,
    city: info.city,
    state: info.state,
    latitude: info.latitude,
    longitude: info.longitude,
  };
}

/**
 * Calculates distances and estimated commute minutes from a candidate's ZIP
 * to all provided group homes, sorted by shortest distance first.
 */
export function calculateGroupHomeDistances(
  candidateZip: string | number | null | undefined,
  groupHomesList: GroupHome[],
): GroupHomeProximity[] {
  const cleanZip = normalizeZipCode(candidateZip);

  return groupHomesList
    .map((home) => {
      const dist = cleanZip ? calculateDistanceMiles(cleanZip, home.zip_code) : null;
      const commute = calculateCommuteMinutes(dist);
      return {
        home,
        distanceMiles: dist !== null ? dist : 9999, // 9999 for sorting unresolved locations to end
        commuteMinutes: commute !== null ? commute : 9999,
      };
    })
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .map((item) => ({
      ...item,
      distanceMiles: item.distanceMiles === 9999 ? (null as unknown as number) : item.distanceMiles,
      commuteMinutes: item.commuteMinutes === 9999 ? (null as unknown as number) : item.commuteMinutes,
    }));
}

/**
 * Finds the single closest group home to a candidate's ZIP code.
 */
export function findClosestGroupHome(
  candidateZip: string | number | null | undefined,
  groupHomesList: GroupHome[],
): GroupHomeProximity | null {
  const ranked = calculateGroupHomeDistances(candidateZip, groupHomesList);
  if (ranked.length === 0) return null;
  // Return the first valid one if available
  const valid = ranked.find((r) => r.distanceMiles !== null && r.distanceMiles !== undefined);
  return valid || ranked[0] || null;
}
