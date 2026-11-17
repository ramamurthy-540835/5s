import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@backend/lib/auth";
import { ensureSeeded } from "@backend/lib/bootstrap";
import { env } from "@backend/lib/env";
import { queryBigQuery } from "@backend/lib/bigquery";
import { appKinds, parseAppRecord, type AppName, type AppKind } from "@backend/lib/app-records";
import { appOrgId } from "@backend/lib/app-tenancy";
import { buildStockIntelligence, rankIndiaStocks, type FundamentalSnapshot, type MarketObservation, type RankingMode, type ResearchItem } from "@backend/lib/stock-intelligence";
import { marketDataProviderStatus } from "@backend/lib/market-data-provider";
import { INDIA_REFERENCE_CATALOGUE_NOTICE, indiaReferenceCatalogue } from "@backend/lib/india-reference-catalog";
import { normalizeChartSeries } from "@backend/lib/stock-market-analytics";

type Row = { id: string; owner_id: string; kind: AppKind; status: string; title: string; payload_json: string; created_at: unknown; updated_at: unknown };
type AuctionOverviewListing = { id: string; title: string; reservePrice: number; closesOn: string; listingFee: number; bidCount: number; highestBid: number };
const table = `\`${env.projectId}.${env.dataset}.app_records\``;
const auditTable = `\`${env.projectId}.${env.dataset}.auction_audit_logs\``;
const validApp = (value: string): value is AppName => Object.prototype.hasOwnProperty.call(appKinds, value);
const stamp = (value: unknown) => typeof value === "object" && value !== null && "value" in value ? String((value as { value: unknown }).value) : String(value || "");
const respond = (row: Row, userId: string, app: AppName, isAdmin: boolean) => ({ id: row.id, kind: row.kind, status: row.status, title: row.title,
  // Seller and bidder identities are visible to authorized admins only. Members
  // still receive a server-derived `mine` flag for records they own.
  ownerId: app === "property-auctions" && !isAdmin && row.owner_id !== userId ? "" : row.owner_id,
  mine: row.owner_id === userId, payload: JSON.parse(row.payload_json || "{}"), createdAt: stamp(row.created_at), updatedAt: stamp(row.updated_at) });
const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET(req: Request, { params }: { params: { app: string } }) {
  const user = getSession(req);
  if (!user) return error("Sign in required", 401);
  if (!validApp(params.app)) return error("Unknown application", 404);
  const app = params.app;
  await ensureSeeded();
  const orgId = appOrgId(app, user);
  if (app === "property-auctions" && new URL(req.url).searchParams.get("view") === "overview") {
    const [listings, bids] = await Promise.all([
      queryBigQuery<Row>(`SELECT id,owner_id,kind,status,title,payload_json,created_at,updated_at FROM ${table}
        WHERE org_id=@orgId AND app='property-auctions' AND kind='listing' AND status='open' ORDER BY created_at DESC LIMIT 200`, { orgId }),
      queryBigQuery<{ payload_json: string }>(`SELECT payload_json FROM ${table}
        WHERE org_id=@orgId AND app='property-auctions' AND kind='bid' AND status='simulated' LIMIT 1000`, { orgId }),
    ]);
    const metrics = new Map<string, { bidCount: number; highestBid: number }>();
    for (const bid of bids) {
      try {
        const payload = JSON.parse(bid.payload_json || "{}") as { listingId?: unknown; bidAmount?: unknown };
        const listingId = String(payload.listingId || "");
        if (!listingId) continue;
        const current = metrics.get(listingId) || { bidCount: 0, highestBid: 0 };
        current.bidCount += 1;
        current.highestBid = Math.max(current.highestBid, Number(payload.bidAmount) || 0);
        metrics.set(listingId, current);
      } catch { /* Ignore malformed historical payloads without exposing them. */ }
    }
    const openListings: AuctionOverviewListing[] = listings.map((listing) => {
      const payload = JSON.parse(listing.payload_json || "{}") as Record<string, unknown>;
      const metric = metrics.get(listing.id) || { bidCount: 0, highestBid: 0 };
      return { id: listing.id, title: listing.title, reservePrice: Number(payload.reservePrice) || 0,
        closesOn: String(payload.closesOn || ""), listingFee: Number(payload.listingFee) || 0, ...metric };
    });
    return NextResponse.json({ openListings, simulatedBidCount: bids.length }, { headers: { "Cache-Control": "no-store" } });
  }
  const stockView = new URL(req.url).searchParams.get("view");
  if (app === "stock-exchange" && ["intelligence", "top5", "search"].includes(stockView || "")) {
    const providerStatus = marketDataProviderStatus();
    const rows = await queryBigQuery<Row>(`SELECT id,owner_id,kind,status,title,payload_json,created_at,updated_at FROM ${table}
      WHERE org_id=@orgId AND owner_id=@userId AND app='stock-exchange'
      AND kind IN UNNEST(@kinds) ORDER BY created_at ASC LIMIT 10000`,
      { orgId, userId: user.id, kinds: ["instrument", "market-observation", "fundamental-snapshot", "research-item"] });
    const parsed = rows.flatMap((row) => { try { return [{ kind: row.kind, payload: JSON.parse(row.payload_json || "{}") as Record<string, unknown> }]; } catch { return []; } });
    const workspaceSymbols = [...new Map(parsed.filter((row) => typeof row.payload.symbol === "string" && typeof row.payload.exchange === "string")
      .map((row) => {
        const exchange = String(row.payload.exchange).toUpperCase(); const symbol = String(row.payload.symbol).toUpperCase();
        return [`${exchange}:${symbol}`, { exchange, symbol, instrumentId: `${exchange}:${symbol}`,
          companyName: typeof row.payload.companyName === "string" ? row.payload.companyName : null,
          aliases: Array.isArray(row.payload.aliases) ? row.payload.aliases.filter((item): item is string => typeof item === "string").slice(0, 20) : [],
          isin: typeof row.payload.isin === "string" ? row.payload.isin : null,
          tradingStatus: typeof row.payload.tradingStatus === "string" ? row.payload.tradingStatus : "unknown" }];
      })).values()];
    // Workspace records win over curated reference records because they carry
    // the user's own provenance and can have actual sourced observations.
    const symbols = [...new Map([...indiaReferenceCatalogue, ...workspaceSymbols]
      .map((item) => [item.instrumentId, item])).values()];
    const requested = (new URL(req.url).searchParams.get("instrument") || new URL(req.url).searchParams.get("symbol"))?.toUpperCase();
    if (stockView === "search") {
      const query = (new URL(req.url).searchParams.get("q") || "").trim().toUpperCase();
      if (query.length < 3) return NextResponse.json({ instruments: [], nextCursor: null, minimumQueryLength: 3 }, { headers: { "Cache-Control": "no-store" } });
      const exchange = (new URL(req.url).searchParams.get("exchange") || "").toUpperCase();
      const limit = Math.max(1, Math.min(50, Number(new URL(req.url).searchParams.get("limit")) || 20));
      const offset = Math.max(0, Number(new URL(req.url).searchParams.get("cursor")) || 0);
      const ranked = symbols.filter((item) => !exchange || item.exchange === exchange).map((item) => {
        const candidates = [item.symbol, item.companyName || "", item.isin || "", ...item.aliases].map((value) => value.toUpperCase());
        const exact = candidates.some((value) => value === query); const prefix = candidates.some((value) => value.startsWith(query));
        return { ...item, rank: exact ? 0 : prefix ? 1 : 2, matches: candidates.some((value) => value.includes(query)) };
      }).filter((item) => item.matches).sort((a, b) => a.rank - b.rank || a.symbol.localeCompare(b.symbol));
      const matches = ranked.slice(offset, offset + limit)
        .map(({ rank, matches, ...item }) => item);
      return NextResponse.json({ instruments: matches, nextCursor: offset + limit < ranked.length ? String(offset + limit) : null, minimumQueryLength: 3,
        catalogueNotice: INDIA_REFERENCE_CATALOGUE_NOTICE }, { headers: { "Cache-Control": "no-store" } });
    }
    const selected = symbols.find((item) => `${item.exchange}:${item.symbol}` === requested) || workspaceSymbols[0];
    const observations = parsed.filter((row) => row.kind === "market-observation").map((row) => row.payload as unknown as MarketObservation);
    const fundamentals = parsed.filter((row) => row.kind === "fundamental-snapshot").map((row) => row.payload as unknown as FundamentalSnapshot);
    const research = parsed.filter((row) => row.kind === "research-item").map((row) => row.payload as unknown as ResearchItem);
    if (stockView === "top5") {
      const candidateMode = new URL(req.url).searchParams.get("mode") || "balanced";
      const exchange = (new URL(req.url).searchParams.get("exchange") || "").toUpperCase();
      if (["top-gainers", "most-active", "market-leaders"].includes(candidateMode)) {
        return NextResponse.json({ selected: [], excluded: [], exchange: exchange || null, mode: candidateMode, providerStatus,
          limitation: `${candidateMode.replaceAll("-", " ")} requires an authorized market-data provider with current exchange-wide price, volume, or market-cap coverage.` }, { headers: { "Cache-Control": "no-store" } });
      }
      const mode: RankingMode = ["momentum", "quality", "value", "growth", "balanced"].includes(candidateMode) ? candidateMode as RankingMode : "balanced";
      const includeFlagged = new URL(req.url).searchParams.get("includeFlagged") === "true";
      const candidates = exchange ? symbols.filter((symbol) => symbol.exchange === exchange) : symbols;
      return NextResponse.json({ ...rankIndiaStocks(candidates.map((symbol) => ({ ...symbol, observations, fundamentals, research })), mode, { includeFlagged, limit: 5 }), exchange: exchange || null,
        providerStatus, limitation: providerStatus.configured ? "Rankings use eligible sourced workspace records until the provider ingestion job is enabled." : "No licensed market-data provider is configured. Results use only your sourced workspace records." }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!selected) return NextResponse.json({ symbols: [], report: null, disclaimer: "For research and education only. Not investment advice. Forecasts are uncertain; losses are possible. No broker execution is connected." }, { headers: { "Cache-Control": "no-store" } });
    const selectedObservations = observations.filter((row) => row.symbol === selected.symbol && row.exchange === selected.exchange);
    return NextResponse.json({ symbols, providerStatus, catalogueNotice: INDIA_REFERENCE_CATALOGUE_NOTICE, chartSeries: normalizeChartSeries(selectedObservations), report: buildStockIntelligence({ ...selected, observations, fundamentals, research }) }, { headers: { "Cache-Control": "no-store" } });
  }
  const personalRecords = app === "stock-exchange" || (app === "property-auctions" && user.role !== "admin");
  const rows = await queryBigQuery<Row>(`SELECT id,owner_id,kind,status,title,payload_json,created_at,updated_at FROM ${table}
    WHERE org_id=@orgId AND app=@app AND (@private=FALSE OR owner_id=@userId)
    ORDER BY created_at DESC LIMIT 200`, { orgId, app, private: personalRecords, userId: user.id });
  return NextResponse.json(rows.map((row) => respond(row, user.id, app, user.role === "admin")), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { app: string } }) {
  const user = getSession(req);
  if (!user) return error("Sign in required", 401);
  if (!validApp(params.app)) return error("Unknown application", 404);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return error("Valid JSON required"); }
  const kind = String(body.kind || "") as AppKind;
  let parsed: ReturnType<typeof parseAppRecord>;
  try { parsed = parseAppRecord(params.app, kind, body.payload); }
  catch (cause) { return error(cause instanceof Error ? cause.message : "Invalid record"); }
  await ensureSeeded();
  const orgId = appOrgId(params.app, user);
  if (kind === "route-option") {
    const shipment = await queryBigQuery<{ id: string; owner_id: string }>(`SELECT id,owner_id FROM ${table} WHERE id=@shipmentId
      AND org_id=@orgId AND app='textile-exports' AND kind='shipment' LIMIT 1`,
      { shipmentId: parsed.payload.shipmentId, orgId });
    if (!shipment[0] || shipment[0].owner_id !== user.id) return error("Choose one of your export cases", 403);
  }
  if (kind === "bid") {
    const listingId = String(parsed.payload.listingId);
    const listings = await queryBigQuery<Row>(`SELECT id,owner_id,kind,status,title,payload_json,created_at,updated_at FROM ${table}
      WHERE id=@listingId AND org_id=@orgId AND app='property-auctions' AND kind='listing' AND status='open' LIMIT 1`,
      { listingId, orgId });
    const listing = listings[0];
    if (!listing) return error("This listing is not open", 409);
    if (listing.owner_id === user.id) return error("Owners cannot bid on their own listing", 403);
    const listingData = JSON.parse(listing.payload_json || "{}");
    if (Date.parse(`${listingData.closesOn}T23:59:59Z`) < Date.now()) return error("The auction has closed", 409);
    if (Number(parsed.payload.bidAmount) < Number(listingData.reservePrice)) return error("Bid must meet the reserve price", 400);
    const verified = await queryBigQuery<{ id: string }>(`SELECT id FROM ${table} WHERE org_id=@orgId AND owner_id=@userId
      AND app='property-auctions' AND kind='bidder' AND status='verified' LIMIT 1`, { orgId, userId: user.id });
    if (!verified[0]) return error("Bidder verification is required", 403);
    const priorBids = await queryBigQuery<{ payload_json: string }>(`SELECT payload_json FROM ${table} WHERE org_id=@orgId
      AND app='property-auctions' AND kind='bid' AND status='simulated'`, { orgId });
    const highest = priorBids.map((row) => JSON.parse(row.payload_json)).filter((bid) => bid.listingId === listingId)
      .reduce((max, bid) => Math.max(max, Number(bid.bidAmount)), 0);
    if (Number(parsed.payload.bidAmount) <= highest) return error("Bid must exceed the current highest simulated bid", 400);
  }
  if (kind === "instrument") {
    const existing = await queryBigQuery<{ id: string }>(`SELECT id FROM ${table} WHERE org_id=@orgId AND owner_id=@userId
      AND app='stock-exchange' AND kind='instrument' AND title=@title LIMIT 1`,
      { orgId, userId: user.id, title: parsed.title });
    if (existing[0]) return error("Symbol already exists in your watchlist; edit its price instead", 409);
  }
  if (kind === "paper-order") {
    const exchange = String(parsed.payload.exchange);
    const symbol = String(parsed.payload.symbol);
    const instruments = await queryBigQuery<Row>(`SELECT id,owner_id,kind,status,title,payload_json,created_at,updated_at FROM ${table}
      WHERE org_id=@orgId AND owner_id=@userId AND app='stock-exchange' AND kind='instrument' AND title=@title LIMIT 1`,
      { orgId, userId: user.id, title: `${exchange}:${symbol}` });
    if (!instruments[0]) return error("Add the symbol to your watchlist first", 400);
    if (parsed.payload.side === "sell") {
      const orders = await queryBigQuery<{ payload_json: string }>(`SELECT payload_json FROM ${table} WHERE org_id=@orgId AND owner_id=@userId
        AND app='stock-exchange' AND kind='paper-order'`, { orgId, userId: user.id });
      const held = orders.map((row) => JSON.parse(row.payload_json)).filter((order) => order.symbol === symbol && order.exchange === exchange)
        .reduce((total, order) => total + (order.side === "buy" ? 1 : -1) * Number(order.quantity), 0);
      if (held < Number(parsed.payload.quantity)) return error("Not enough paper shares to sell", 400);
    }
  }
  const id = randomUUID();
  const status = kind === "bidder" ? "pending" : ["bid", "paper-order"].includes(kind) ? "simulated" : "draft";
  await queryBigQuery(`INSERT INTO ${table} (id,org_id,owner_id,app,kind,status,title,payload_json,created_at,updated_at)
    VALUES (@id,@orgId,@userId,@app,@kind,@status,@title,@payloadJson,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())`,
    { id, orgId, userId: user.id, app: params.app, kind, status, title: parsed.title, payloadJson: JSON.stringify(parsed.payload) });
  return NextResponse.json({ id, kind, status, title: parsed.title, payload: parsed.payload }, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { app: string } }) {
  const user = getSession(req);
  if (!user) return error("Sign in required", 401);
  if (!validApp(params.app)) return error("Unknown application", 404);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return error("Valid JSON required"); }
  const id = String(body.id || "");
  if (!/^[a-f0-9-]{36}$/.test(id)) return error("Valid record ID required");
  await ensureSeeded();
  const orgId = appOrgId(params.app, user);
  const rows = await queryBigQuery<Row>(`SELECT id,owner_id,kind,status,title,payload_json,created_at,updated_at FROM ${table}
    WHERE id=@id AND org_id=@orgId AND app=@app LIMIT 1`, { id, orgId, app: params.app });
  const row = rows[0];
  if (!row) return error("Record not found", 404);
  const isOwner = row.owner_id === user.id;
  const isAdmin = user.role === "admin";
  if (body.payload !== undefined) {
    if (!isOwner || row.status !== "draft" || !["shipment", "listing", "instrument"].includes(row.kind)) return error("Only the owner can edit a draft", 403);
    let parsed: ReturnType<typeof parseAppRecord>;
    try { parsed = parseAppRecord(params.app, row.kind, body.payload); }
    catch (cause) { return error(cause instanceof Error ? cause.message : "Invalid record"); }
    const previousPayload = JSON.parse(row.payload_json || "{}") as Record<string, unknown>;
    const payload = row.kind === "listing" ? { ...parsed.payload, documents: Array.isArray(previousPayload.documents) ? previousPayload.documents : [] } : parsed.payload;
    await queryBigQuery(`UPDATE ${table} SET title=@title,payload_json=@payloadJson,updated_at=CURRENT_TIMESTAMP() WHERE id=@id AND org_id=@orgId`,
      { id, orgId, title: parsed.title, payloadJson: JSON.stringify(payload) });
    return NextResponse.json({ id, title: parsed.title, payload });
  }
  const next = String(body.status || "");
  const allowed = row.kind === "shipment" ?
    ((isOwner && row.status === "draft" && next === "review") || (isAdmin && row.status === "review" && ["approved", "changes_requested"].includes(next)) || (isOwner && row.status === "changes_requested" && next === "draft")) :
    row.kind === "listing" ?
      ((isOwner && row.status === "draft" && next === "review") || (isAdmin && row.status === "review" && ["open", "rejected", "changes_requested"].includes(next)) || (isOwner && ["changes_requested", "rejected"].includes(row.status) && next === "draft") || ((isOwner || isAdmin) && row.status === "open" && next === "closed")) :
      row.kind === "bidder" && isAdmin && row.status === "pending" && ["verified", "rejected"].includes(next);
  if (!allowed) return error("Status change is not allowed", 403);
  await queryBigQuery(`UPDATE ${table} SET status=@next,updated_at=CURRENT_TIMESTAMP() WHERE id=@id AND org_id=@orgId AND status=@current`,
    { id, orgId, next, current: row.status });
  const action = row.kind === "listing" && row.status === "review" && next === "open" ? "listing_approved" :
    row.kind === "listing" && row.status === "review" && next === "rejected" ? "listing_rejected" :
      row.kind === "bidder" && row.status === "pending" && next === "verified" ? "bidder_verified" :
        row.kind === "bidder" && row.status === "pending" && next === "rejected" ? "bidder_rejected" : "";
  if (action) {
    await queryBigQuery(`INSERT INTO ${auditTable}
      (id,org_id,record_id,record_kind,action,from_status,to_status,actor_id,actor_email,subject_user_id,created_at)
      VALUES (@auditId,@orgId,@recordId,@recordKind,@action,@fromStatus,@toStatus,@actorId,@actorEmail,@subjectUserId,CURRENT_TIMESTAMP())`,
      { auditId: randomUUID(), orgId, recordId: row.id, recordKind: row.kind, action,
        fromStatus: row.status, toStatus: next, actorId: user.id, actorEmail: user.email, subjectUserId: row.owner_id });
  }
  return NextResponse.json({ id, status: next });
}
