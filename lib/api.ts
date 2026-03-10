import { NextResponse } from "next/server";

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { message } }, { status });
}
