import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/supabase-common";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/voice", request.url));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/voice", request.url));
}
