export type AppName = "textile-exports" | "property-auctions" | "stock-exchange";
export type AppKind = "shipment" | "route-option" | "listing" | "bidder" | "bid" | "instrument" | "paper-order" | "market-observation" | "fundamental-snapshot" | "research-item";

export const appKinds: Record<AppName, AppKind[]> = {
  "textile-exports": ["shipment", "route-option"],
  "property-auctions": ["listing", "bidder", "bid"],
  "stock-exchange": ["instrument", "paper-order", "market-observation", "fundamental-snapshot", "research-item"],
};

const field = (data: Record<string, unknown>, key: string, max = 300) => String(data[key] ?? "").trim().slice(0, max);
const amount = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 1_000_000_000_000) throw new Error("Enter a positive amount within the supported range");
  return number;
};
const date = (value: unknown) => {
  const result = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result))) throw new Error("Enter a valid date");
  return result;
};
const optionalNumber = (value: unknown, key: string, min = -1_000_000_000_000, max = 1_000_000_000_000) => {
  if (value === undefined || value === null || value === "") return undefined;
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(`Enter a valid ${key}`);
  return result;
};
const sourceUrl = (value: unknown) => {
  const result = field({ value }, "value", 2048);
  try { const url = new URL(result); if (url.protocol !== "https:") throw new Error(); return url.toString(); }
  catch { throw new Error("Enter a valid HTTPS source URL"); }
};
const sourceClass = (value: unknown) => {
  const result = field({ value }, "value", 40);
  if (!["verified_filing", "company_statement", "analyst_opinion", "media_report", "rumor", "unverified_claim"].includes(result)) throw new Error("Choose a valid source classification");
  return result;
};

export function parseAppRecord(app: AppName, kind: AppKind, input: unknown) {
  if (!appKinds[app]?.includes(kind)) throw new Error("Unknown app or record type");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Enter record details");
  const data = input as Record<string, unknown>;
  if (kind === "shipment") {
    const product = field(data, "product", 120);
    const destination = field(data, "destination", 80);
    const origin = field(data, "origin", 80);
    if (!product || !destination || !origin) throw new Error("Product, origin, and destination are required");
    return { title: `${product} to ${destination}`, payload: {
      product, hsCode: field(data, "hsCode", 20), origin, destination,
      buyer: field(data, "buyer", 120), route: field(data, "route", 500),
      invoiceValue: data.invoiceValue ? amount(data.invoiceValue) : null,
      currency: field(data, "currency", 3).toUpperCase() || "USD",
      documentNotes: field(data, "documentNotes", 1000),
      customsAdvice: field(data, "customsAdvice", 1000),
    } };
  }
  if (kind === "route-option") {
    const shipmentId = field(data, "shipmentId", 100);
    const market = field(data, "market", 80);
    if (!shipmentId || !market) throw new Error("Choose a case and destination market");
    const goodsValue = amount(data.goodsValue);
    const freight = Number(data.freight ?? 0);
    const otherCosts = Number(data.otherCosts ?? 0);
    const dutyRate = Number(data.dutyRate ?? 0);
    const transitDays = Number(data.transitDays ?? 0);
    if (![freight, otherCosts, dutyRate, transitDays].every(Number.isFinite) || freight < 0 || otherCosts < 0 || dutyRate < 0 || dutyRate > 100 || !Number.isInteger(transitDays) || transitDays < 0 || transitDays > 365)
      throw new Error("Enter valid freight, other costs, duty estimate (0–100%) and transit days");
    return { title: `Route to ${market}`, payload: { shipmentId, market, goodsValue, freight, otherCosts, dutyRate, transitDays,
      landedEstimate: Math.round((goodsValue * (1 + dutyRate / 100) + freight + otherCosts) * 100) / 100,
      provider: field(data, "provider", 120), notes: field(data, "notes", 1000) } };
  }
  if (kind === "listing") {
    const address = field(data, "address", 300);
    const seller = field(data, "seller", 120);
    if (!address || !seller) throw new Error("Property address and seller are required");
    const closesOn = date(data.closesOn);
    if (Date.parse(`${closesOn}T23:59:59Z`) < Date.now()) throw new Error("Closing date must be in the future");
    const valuation = amount(data.valuation);
    return { title: address, payload: { address, seller, description: field(data, "description", 1500),
      reservePrice: amount(data.reservePrice), valuation, listingFee: Math.round(valuation * 0.0025 * 100) / 100, closesOn,
      authorityNotes: field(data, "authorityNotes", 1000), titleNotes: field(data, "titleNotes", 1000), documents: [] } };
  }
  if (kind === "bidder") return { title: "Bidder verification request", payload: { note: field(data, "note", 500) } };
  if (kind === "bid") {
    const bidAmount = amount(data.bidAmount);
    return { title: "Simulated bid", payload: { listingId: field(data, "listingId", 100), bidAmount, depositPreview: Math.round(bidAmount * 0.25 * 100) / 100 } };
  }
  if (kind === "instrument") {
    const symbol = field(data, "symbol", 20).toUpperCase();
    const exchange = field(data, "exchange", 20).toUpperCase();
    if (!/^[A-Z0-9.\-_]{1,20}$/.test(symbol) || !/^[A-Z0-9.\-_]{1,20}$/.test(exchange)) throw new Error("Enter a valid symbol and exchange");
    const priceAsOf = date(data.priceAsOf);
    if (priceAsOf > new Date().toISOString().slice(0, 10)) throw new Error("Reference price date cannot be in the future");
    const isin = field(data, "isin", 12).toUpperCase();
    if (isin && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) throw new Error("Enter a valid 12-character ISIN");
    const aliases = field(data, "aliases", 500).split(",").map((value) => value.trim()).filter(Boolean).slice(0, 20);
    const tradingStatus = field(data, "tradingStatus", 20).toLowerCase() || "unknown";
    if (!["active", "suspended", "delisted", "unknown"].includes(tradingStatus)) throw new Error("Choose a valid trading status");
    return { title: `${exchange}:${symbol}`, payload: { symbol, exchange, companyName: field(data, "companyName", 200), aliases, isin, tradingStatus,
      note: field(data, "note", 500), referencePrice: amount(data.referencePrice), priceAsOf } };
  }
  if (kind === "market-observation") {
    const symbol = field(data, "symbol", 20).toUpperCase(); const exchange = field(data, "exchange", 20).toUpperCase();
    if (!/^[A-Z0-9.\-_]{1,20}$/.test(symbol) || !/^[A-Z0-9.\-_]{1,20}$/.test(exchange)) throw new Error("Enter a valid symbol and exchange");
    const asOf = date(data.asOf); if (asOf > new Date().toISOString().slice(0, 10)) throw new Error("Observation date cannot be in the future");
    return { title: `${exchange}:${symbol} ${asOf}`, payload: { symbol, exchange, asOf, close: amount(data.close), high: optionalNumber(data.high, "high", 0), low: optionalNumber(data.low, "low", 0), volume: optionalNumber(data.volume, "volume", 0), niftyClose: optionalNumber(data.niftyClose, "Nifty 50 close", 0), sectorClose: optionalNumber(data.sectorClose, "sector index close", 0), indiaVix: optionalNumber(data.indiaVix, "India VIX", 0), usdInr: optionalNumber(data.usdInr, "USD/INR", 0), brent: optionalNumber(data.brent, "Brent crude", 0), repoRate: optionalNumber(data.repoRate, "repo rate", 0), inflation: optionalNumber(data.inflation, "inflation"), fiiNetFlow: optionalNumber(data.fiiNetFlow, "FII/FPI flow"), sourceUrl: sourceUrl(data.sourceUrl), sourceClass: sourceClass(data.sourceClass) } };
  }
  if (kind === "fundamental-snapshot") {
    const symbol = field(data, "symbol", 20).toUpperCase(); const exchange = field(data, "exchange", 20).toUpperCase();
    if (!/^[A-Z0-9.\-_]{1,20}$/.test(symbol) || !/^[A-Z0-9.\-_]{1,20}$/.test(exchange)) throw new Error("Enter a valid symbol and exchange");
    const asOf = date(data.asOf); const fiscalPeriod = field(data, "fiscalPeriod", 30); if (!fiscalPeriod) throw new Error("Fiscal period is required");
    return { title: `${exchange}:${symbol} fundamentals ${fiscalPeriod}`, payload: { symbol, exchange, asOf, fiscalPeriod, revenue: optionalNumber(data.revenue, "revenue"), netProfit: optionalNumber(data.netProfit, "net profit"), ebitdaMargin: optionalNumber(data.ebitdaMargin, "EBITDA margin"), eps: optionalNumber(data.eps, "EPS"), roe: optionalNumber(data.roe, "ROE"), roce: optionalNumber(data.roce, "ROCE"), debtToEquity: optionalNumber(data.debtToEquity, "debt to equity"), freeCashFlow: optionalNumber(data.freeCashFlow, "free cash flow"), pe: optionalNumber(data.pe, "P/E", 0), pb: optionalNumber(data.pb, "P/B", 0), evEbitda: optionalNumber(data.evEbitda, "EV/EBITDA", 0), dividendYield: optionalNumber(data.dividendYield, "dividend yield", 0), sourceUrl: sourceUrl(data.sourceUrl), sourceClass: sourceClass(data.sourceClass) } };
  }
  if (kind === "research-item") {
    const symbol = field(data, "symbol", 20).toUpperCase(); const exchange = field(data, "exchange", 20).toUpperCase(); const title = field(data, "title", 300);
    if (!/^[A-Z0-9.\-_]{1,20}$/.test(symbol) || !/^[A-Z0-9.\-_]{1,20}$/.test(exchange) || !title) throw new Error("Symbol, exchange and title are required");
    const publishedAt = date(data.publishedAt); const materiality = field(data, "materiality", 10);
    if (!["low", "medium", "high"].includes(materiality)) throw new Error("Choose a valid materiality");
    return { title, payload: { symbol, exchange, publishedAt, title, summary: field(data, "summary", 2000), materiality, sourceUrl: sourceUrl(data.sourceUrl), sourceClass: sourceClass(data.sourceClass), conflicted: data.conflicted === true || data.conflicted === "true" } };
  }
  const symbol = field(data, "symbol", 20).toUpperCase();
  const side = field(data, "side", 4).toLowerCase();
  if (!/^[A-Z0-9.\-_]{1,20}$/.test(symbol) || !["buy", "sell"].includes(side)) throw new Error("Choose a valid symbol and side");
  const quantity = amount(data.quantity);
  if (!Number.isInteger(quantity) || quantity > 1_000_000) throw new Error("Quantity must be a whole number up to one million");
  return { title: `${side.toUpperCase()} ${quantity} ${symbol}`, payload: {
    symbol, exchange: field(data, "exchange", 20).toUpperCase(), side, quantity,
    price: amount(data.price), note: field(data, "note", 500),
  } };
}
