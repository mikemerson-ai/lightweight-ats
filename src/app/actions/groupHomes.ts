"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { GroupHome } from "@/types/groupHomes";

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

/**
 * Fetch all group homes from the database, falling back to default seeded list if table is pending.
 */
export async function getGroupHomes(): Promise<GroupHome[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("group_homes")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("Failed to fetch group_homes from database, using fallback:", error.message);
      return DEFAULT_GROUP_HOMES;
    }

    if (!data || data.length === 0) {
      return DEFAULT_GROUP_HOMES;
    }

    return data as GroupHome[];
  } catch (err) {
    console.warn("Error fetching group homes:", err);
    return DEFAULT_GROUP_HOMES;
  }
}

/**
 * Create a new group home
 */
export async function createGroupHome(
  home: Omit<GroupHome, "id" | "created_at" | "updated_at">,
): Promise<{ success: boolean; data?: GroupHome; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("group_homes")
      .insert({
        name: home.name.trim(),
        address: home.address.trim(),
        city: home.city.trim(),
        state: home.state.trim().toUpperCase(),
        zip_code: home.zip_code.trim(),
        is_active: home.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/");
    return { success: true, data: data as GroupHome };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Update an existing group home
 */
export async function updateGroupHome(
  id: string,
  updates: Partial<Omit<GroupHome, "id" | "created_at">>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("group_homes")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Toggle group home active/inactive status
 */
export async function toggleGroupHomeStatus(
  id: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  return updateGroupHome(id, { is_active: isActive });
}
