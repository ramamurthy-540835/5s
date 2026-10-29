import { NextResponse } from "next/server";
import { getSession } from "@backend/lib/auth";

export async function POST(req: Request) {
  const user = getSession(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  let body: { email?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Valid JSON required" }, { status: 400 }); }
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

  // A browser has one HTTP-only PRISM session. Never mint or infer a session
  // for another remembered account; require that account's password instead.
  if (email !== user.email.toLowerCase()) return NextResponse.json({ error: "A new sign-in is required" }, { status: 409 });
  return NextResponse.json({ user: { email: user.email, role: user.role } });
}
