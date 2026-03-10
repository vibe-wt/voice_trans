import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/db/supabase-common";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function getViewerContext() {
  const user = await getCurrentUser();

  return {
    user,
    isAuthenticated: Boolean(user),
    isDemoMode: !isSupabaseConfigured()
  };
}
