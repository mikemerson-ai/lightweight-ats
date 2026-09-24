"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { GroupHome } from "@/types/groupHomes";
import { DEFAULT_GROUP_HOMES } from "@/types/groupHomes";


/**
 * Fetch all group homes from the database, falling back to default seeded list if table is pending.
 */
export async function getGroupHomes(): Promise<GroupHome[]> {
  try {
    // Use admin client to bypass RLS — group homes are non-sensitive reference data
    const supabase = createAdminClient();
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
