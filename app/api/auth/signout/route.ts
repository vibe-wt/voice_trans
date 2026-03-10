import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/supabase-common";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/", request.url));
}
