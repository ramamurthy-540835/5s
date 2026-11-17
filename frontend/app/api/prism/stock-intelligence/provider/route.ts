import { NextResponse } from "next/server";
import { getSession } from "@backend/lib/auth";
import { marketDataProviderStatus, marketDataProviders } from "@backend/lib/market-data-provider";

const unauthorized = () => NextResponse.json({ error: "Administrator access required." }, { status: 403 });

/** Safe diagnostics only: credentials and Secret Manager values never leave Cloud Run. */
export async function GET(req: Request) {
  const user = getSession(req);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "admin") return unauthorized();
  const status = marketDataProviderStatus();
  return NextResponse.json({ ...status, providers: marketDataProviders.health(), secretReferenceConfigured: Boolean(process.env.MARKET_DATA_API_KEY), baseUrlConfigured: Boolean(process.env.MARKET_DATA_BASE_URL) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const user = getSession(req);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "admin") return unauthorized();
  let body: { action?: unknown }; try { body = await req.json(); } catch { return NextResponse.json({ error: "Valid JSON required." }, { status: 400 }); }
  if (body.action !== "test") return NextResponse.json({ error: "Only the diagnostic test action is supported." }, { status: 400 });
  const status = marketDataProviderStatus();
  // A registered adapter reports health without issuing a market-data request;
  // activation requires entitlement review outside the browser.
  return NextResponse.json({ testedAt: new Date().toISOString(), status, success: status.health === "healthy", message: status.reason || "Adapter is registered; validate provider-specific credentials in the approved staging workflow." }, { headers: { "Cache-Control": "no-store" } });
}
