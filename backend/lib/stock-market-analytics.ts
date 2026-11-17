import type { FinancialStatementObservation, FundamentalSnapshot, MarketObservation } from "./stock-intelligence";

export type MarketIndex = "NIFTY 50" | "SENSEX" | "NIFTY BANK" | "INDIA VIX";
export type MarketIndexObservation = { index: MarketIndex; asOf: string; value: number; previousClose?: number; sourceUrl: string; classification: "live" | "delayed" | "EOD" };
export type MarketInstrument = { instrumentId: string; symbol: string; exchange: "NSE" | "BSE"; companyName: string; sector?: string; industry?: string; marketCap?: number; observations: MarketObservation[]; fundamentals: FundamentalSnapshot[]; evidenceCoveragePct: number };
export type ChartPoint = { time: string; open: number; high: number; low: number; close: number; volume: number | null };
export type ScreenerFilters = { exchange?: "NSE" | "BSE"; sector?: string; industry?: string; search?: string; minMarketCap?: number; maxPe?: number; minRoe?: number; minRoce?: number; maxDebtToEquity?: number; minDividendYield?: number; minEvidenceCoveragePct?: number; minRsi?: number; maxRsi?: number; minVolume?: number; maxVolatilityPct?: number };
export type FinancialTrendPoint = { periodEnd: string; publishedAt: string; value: number; currency: string; unit: FinancialStatementObservation["unit"]; sourceUrl: string; scope: FinancialStatementObservation["scope"]; periodType: FinancialStatementObservation["periodType"] };

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const latest = <T extends { asOf: string }>(items: T[]) => [...items].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf)).at(-1);
const ratio = (numerator?: number, denominator?: number) => finite(numerator) && finite(denominator) && denominator !== 0 ? numerator / denominator : null;

export function normalizeChartSeries(rows: MarketObservation[]): ChartPoint[] {
  const unique = new Map<string, MarketObservation>();
  for (const row of rows) if (finite(row.close) && row.close > 0 && !unique.has(row.asOf)) unique.set(row.asOf, row);
  return [...unique.values()].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf)).map((row) => ({ time: row.asOf, open: row.close, high: finite(row.high) ? row.high : row.close, low: finite(row.low) ? row.low : row.close, close: row.close, volume: finite(row.volume) && row.volume >= 0 ? row.volume : null }));
}

/**
 * Applies a canonical identity to sourced statements and drops unusable or
 * duplicate disclosures. This is deliberately ingestion-only: it never tries
 * to infer a missing financial value from another period.
 */
export function normalizeFinancialStatements(rows: FinancialStatementObservation[]) {
  const unique = new Map<string, FinancialStatementObservation>();
  for (const row of rows) {
    if (!row.symbol || !row.exchange || !row.sourceUrl || !row.currency || Number.isNaN(Date.parse(row.periodEnd)) || Number.isNaN(Date.parse(row.publishedAt))) continue;
    const values = Object.fromEntries(Object.entries(row.values || {}).map(([key, value]) => [key, finite(value) ? value : null]));
    const normalized = { ...row, values };
    const key = [row.symbol, row.exchange, row.statement, row.scope, row.periodType, row.periodEnd, row.sourceUrl].join(":");
    const prior = unique.get(key);
    // A source-marked restatement supersedes an earlier version of the same disclosure.
    if (!prior || (normalized.restated && !prior.restated) || normalized.publishedAt > prior.publishedAt) unique.set(key, normalized);
  }
  return [...unique.values()].sort((a, b) => Date.parse(a.periodEnd) - Date.parse(b.periodEnd) || Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
}

/** Returns only actual sourced values for a statement metric, never zero-fills gaps. */
export function buildFinancialTrend(rows: FinancialStatementObservation[], metric: string, options: { statement?: FinancialStatementObservation["statement"]; scope?: FinancialStatementObservation["scope"]; periodType?: FinancialStatementObservation["periodType"] } = {}): FinancialTrendPoint[] {
  return normalizeFinancialStatements(rows)
    .filter((row) => (!options.statement || row.statement === options.statement) && (!options.scope || row.scope === options.scope) && (!options.periodType || row.periodType === options.periodType))
    .flatMap((row) => finite(row.values[metric]) ? [{ periodEnd: row.periodEnd, publishedAt: row.publishedAt, value: row.values[metric] as number, currency: row.currency, unit: row.unit, sourceUrl: row.sourceUrl, scope: row.scope, periodType: row.periodType }] : []);
}

export function calculateFundamentalMetrics(snapshot?: FundamentalSnapshot & { ebitda?: number; operatingProfit?: number; totalAssets?: number; totalEquity?: number; totalDebt?: number; currentAssets?: number; currentLiabilities?: number; interestExpense?: number; enterpriseValue?: number }) {
  if (!snapshot) return { available: false, reason: "No sourced fundamental snapshot is available." };
  const revenue = snapshot.revenue; const profit = snapshot.netProfit; const assets = snapshot.totalAssets; const equity = snapshot.totalEquity;
  return { available: true, asOf: snapshot.asOf, fiscalPeriod: snapshot.fiscalPeriod, sourceUrl: snapshot.sourceUrl,
    revenue, netProfit: profit, ebitda: snapshot.ebitda, operatingProfit: snapshot.operatingProfit, eps: snapshot.eps,
    ebitdaMarginPct: finite(snapshot.ebitdaMargin) ? snapshot.ebitdaMargin : finite(snapshot.ebitda) && finite(revenue) ? snapshot.ebitda / revenue * 100 : null,
    operatingMarginPct: finite(snapshot.operatingProfit) && finite(revenue) ? snapshot.operatingProfit / revenue * 100 : null,
    netMarginPct: finite(profit) && finite(revenue) ? profit / revenue * 100 : null,
    roePct: finite(snapshot.roe) ? snapshot.roe : ratio(profit, equity) === null ? null : ratio(profit, equity)! * 100,
    roaPct: ratio(profit, assets) === null ? null : ratio(profit, assets)! * 100,
    rocePct: snapshot.roce ?? null, pe: snapshot.pe ?? null, pb: snapshot.pb ?? null, evEbitda: snapshot.evEbitda ?? (ratio(snapshot.enterpriseValue, snapshot.ebitda)),
    debtToEquity: snapshot.debtToEquity ?? ratio(snapshot.totalDebt, equity), interestCoverage: ratio(snapshot.operatingProfit, snapshot.interestExpense), currentRatio: ratio(snapshot.currentAssets, snapshot.currentLiabilities), freeCashFlow: snapshot.freeCashFlow ?? null, dividendYield: snapshot.dividendYield ?? null,
  };
}

export function buildMarketOverview(indices: MarketIndexObservation[], instruments: MarketInstrument[]) {
  const indexCards = (["NIFTY 50", "SENSEX", "NIFTY BANK", "INDIA VIX"] as MarketIndex[]).map((index) => { const row = latest(indices.filter((item) => item.index === index)); return row ? { index, available: true, value: row.value, change: finite(row.previousClose) ? row.value - row.previousClose : null, changePct: finite(row.previousClose) && row.previousClose ? (row.value / row.previousClose - 1) * 100 : null, asOf: row.asOf, classification: row.classification, sourceUrl: row.sourceUrl } : { index, available: false, value: null, change: null, changePct: null, asOf: null, classification: "unavailable", sourceUrl: null }; });
  const latestRows = instruments.map((instrument) => ({ instrument, row: latest(instrument.observations) })).filter((item): item is { instrument: MarketInstrument; row: MarketObservation } => Boolean(item.row));
  const movers = latestRows.map(({ instrument, row }) => { const previous = [...instrument.observations].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf)).at(-2); return { instrumentId: instrument.instrumentId, symbol: instrument.symbol, exchange: instrument.exchange, close: row.close, volume: row.volume ?? null, changePct: previous?.close ? (row.close / previous.close - 1) * 100 : null }; });
  const advancing = movers.filter((item) => finite(item.changePct) && item.changePct > 0).length; const declining = movers.filter((item) => finite(item.changePct) && item.changePct < 0).length;
  return { indexCards, marketStatus: "unavailable" as const, asOf: indexCards.find((item) => item.asOf)?.asOf || null, breadth: { advancing, declining, unchanged: movers.length - advancing - declining, advanceDeclineRatio: declining ? advancing / declining : null }, topGainers: movers.filter((item) => finite(item.changePct)).sort((a, b) => b.changePct! - a.changePct!).slice(0, 5), topLosers: movers.filter((item) => finite(item.changePct)).sort((a, b) => a.changePct! - b.changePct!).slice(0, 5), mostActive: movers.filter((item) => finite(item.volume)).sort((a, b) => b.volume! - a.volume!).slice(0, 5), universeSize: instruments.length };
}

export function screenInstruments(instruments: MarketInstrument[], filters: ScreenerFilters = {}) {
  const query = filters.search?.trim().toLowerCase();
  const matched = instruments.filter((instrument) => {
    const fundamental = latest(instrument.fundamentals); const observation = latest(instrument.observations);
    const text = `${instrument.symbol} ${instrument.companyName} ${instrument.sector || ""} ${instrument.industry || ""}`.toLowerCase();
    if (filters.exchange && instrument.exchange !== filters.exchange) return false; if (filters.sector && instrument.sector !== filters.sector) return false; if (filters.industry && instrument.industry !== filters.industry) return false; if (query && !text.includes(query)) return false;
    if (finite(filters.minMarketCap) && (!finite(instrument.marketCap) || instrument.marketCap < filters.minMarketCap)) return false; if (finite(filters.maxPe) && (!finite(fundamental?.pe) || fundamental.pe > filters.maxPe)) return false;
    if (finite(filters.minRoe) && (!finite(fundamental?.roe) || fundamental.roe < filters.minRoe)) return false; if (finite(filters.minRoce) && (!finite(fundamental?.roce) || fundamental.roce < filters.minRoce)) return false;
    if (finite(filters.maxDebtToEquity) && (!finite(fundamental?.debtToEquity) || fundamental.debtToEquity > filters.maxDebtToEquity)) return false; if (finite(filters.minDividendYield) && (!finite(fundamental?.dividendYield) || fundamental.dividendYield < filters.minDividendYield)) return false;
    if (finite(filters.minEvidenceCoveragePct) && instrument.evidenceCoveragePct < filters.minEvidenceCoveragePct) return false; if (finite(filters.minVolume) && (!finite(observation?.volume) || observation.volume < filters.minVolume)) return false;
    return true;
  });
  return { results: matched, total: matched.length, universeSize: instruments.length, limitation: instruments.length ? null : "No authorized instrument universe is available for screening." };
}

export function aggregateSectorHeatmap(instruments: MarketInstrument[]) {
  const buckets = new Map<string, Array<{ weight: number; changePct: number }>>();
  for (const instrument of instruments) { const rows = normalizeChartSeries(instrument.observations); if (rows.length < 2 || !instrument.sector) continue; const changePct = (rows.at(-1)!.close / rows.at(-2)!.close - 1) * 100; const weight = finite(instrument.marketCap) && instrument.marketCap > 0 ? instrument.marketCap : 1; const values = buckets.get(instrument.sector) || []; values.push({ weight, changePct }); buckets.set(instrument.sector, values); }
  return [...buckets.entries()].map(([sector, values]) => ({ sector, instruments: values.length, equalWeightedChangePct: values.reduce((sum, item) => sum + item.changePct, 0) / values.length, marketCapWeightedChangePct: values.reduce((sum, item) => sum + item.changePct * item.weight, 0) / values.reduce((sum, item) => sum + item.weight, 0) })).sort((a, b) => b.marketCapWeightedChangePct - a.marketCapWeightedChangePct);
}
