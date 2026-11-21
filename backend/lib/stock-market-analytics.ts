import type { FinancialStatementObservation, FundamentalSnapshot, MarketObservation } from "./stock-intelligence";

export type MarketIndex = "NIFTY 50" | "SENSEX" | "NIFTY BANK" | "INDIA VIX";
export type MarketIndexObservation = { index: MarketIndex; asOf: string; value: number; previousClose?: number; open?: number; high?: number; low?: number; sourceUrl: string; classification: "live" | "delayed" | "EOD"; session?: MarketSession; freshness?: "fresh" | "stale" | "unknown" };
export type MarketInstrument = { instrumentId: string; symbol: string; exchange: "NSE" | "BSE"; companyName: string; sector?: string; industry?: string; marketCap?: number; observations: MarketObservation[]; fundamentals: FundamentalSnapshot[]; financialStatements?: FinancialStatementObservation[]; evidenceCoveragePct: number };
export type ChartPoint = { time: string; open: number; high: number; low: number; close: number; volume: number | null };
export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "MAX";
export type CandleInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1w" | "1mo";
export type ChartTechnicalSeries = { sma20: Array<{ time: string; value: number }>; sma50: Array<{ time: string; value: number }>; sma100: Array<{ time: string; value: number }>; sma200: Array<{ time: string; value: number }>; ema12: Array<{ time: string; value: number }>; ema26: Array<{ time: string; value: number }>; ema50: Array<{ time: string; value: number }>; ema200: Array<{ time: string; value: number }>; bollinger: Array<{ time: string; upper: number; middle: number; lower: number }>; rsi14: Array<{ time: string; value: number }>; macd: Array<{ time: string; macd: number; signal: number | null; histogram: number | null }>; availability: Record<string, { available: boolean; minimumObservations: number; reason: string | null }> };
export type MarketSession = "pre_open" | "open" | "closed" | "holiday" | "special_session" | "unknown";
export type MarketMover = { instrumentId: string; companyName: string; symbol: string; exchange: "NSE" | "BSE"; close: number; previousClose: number; change: number; changePct: number; volume: number | null; turnover: number | null; asOf: string; sourceUrl: string };
export type SectorPerformance = { sector: string; instruments: number; eligibleCompanies: number; advancing: number; declining: number; unchanged: number; unavailableComparisons: number; equalWeightedChangePct: number | null; marketCapWeightedChangePct: number | null; aggregateVolume: number | null; aggregateMarketCap: number | null; marketCapCoveragePct: number | null; lastRefreshedAt: string | null; companies: Array<{ instrumentId: string; companyName: string; symbol: string; exchange: "NSE" | "BSE"; changePct: number; marketCap: number | null; asOf: string }> };
export type ScreenerFilters = { exchange?: "NSE" | "BSE"; sector?: string; industry?: string; search?: string; minMarketCap?: number; maxMarketCap?: number; minPe?: number; maxPe?: number; minPb?: number; maxPb?: number; minRoe?: number; minRoa?: number; minRoce?: number; minRoic?: number; maxDebtToEquity?: number; minCurrentRatio?: number; minQuickRatio?: number; minDividendYield?: number; minFreeCashFlowYield?: number; minRevenueGrowthPct?: number; minProfitGrowthPct?: number; minEpsGrowthPct?: number; minEvidenceCoveragePct?: number; minVolume?: number; minMomentumPct?: number; maxVolatilityPct?: number };
export type ScreenerSort = "company" | "marketCap" | "pe" | "roe" | "roa" | "roce" | "roic" | "debtToEquity" | "currentRatio" | "quickRatio" | "dividendYield" | "freeCashFlowYield" | "revenueGrowthPct" | "profitGrowthPct" | "epsGrowthPct" | "volume" | "momentumPct" | "volatilityPct" | "evidenceCoveragePct" | "lastObservationAt";
export type ScreenerRow = { instrumentId: string; companyName: string; symbol: string; exchange: "NSE" | "BSE"; sector: string | null; industry: string | null; lastPrice: number | null; priceChangePct: number | null; marketCap: number | null; pe: number | null; pb: number | null; roe: number | null; roa: number | null; roce: number | null; roic: number | null; debtToEquity: number | null; currentRatio: number | null; quickRatio: number | null; dividendYield: number | null; freeCashFlowYield: number | null; revenueGrowthPct: number | null; profitGrowthPct: number | null; epsGrowthPct: number | null; volume: number | null; momentumPct: number | null; volatilityPct: number | null; evidenceCoveragePct: number; lastObservationAt: string | null };
export type FinancialTrendPoint = { periodEnd: string; publishedAt: string; value: number; currency: string; unit: FinancialStatementObservation["unit"]; sourceUrl: string; scope: FinancialStatementObservation["scope"]; periodType: FinancialStatementObservation["periodType"] };

export type FinancialValueKind = "monetary" | "percentage" | "shares" | "per_share";
export type NormalizedFinancialValue = { value: number | null; originalUnit: FinancialStatementObservation["unit"] | null; normalizedUnit: "ones" | "percent" | "shares" | "per_share" | null; reason: string | null; methodology: string };
export type TtmFinancialResult = { available: boolean; reason: string | null; scope: FinancialStatementObservation["scope"]; currency: string | null; quarters: FinancialStatementObservation[]; values: Record<string, number | null>; sourceUrls: string[]; latestPublishedAt: string | null; methodology: string };
export type ShareholdingReconciliation = { available: boolean; periodEnd: string | null; reportedTotalPct: number | null; reconciliationDifferencePct: number | null; status: "reconciled" | "incomplete" | "overlapping" | "unavailable"; categories: Array<{ category: string; valuePct: number | null; priorValuePct: number | null; changePp: number | null; parentCategory: string | null; overlapping: boolean }>; sourceUrls: string[]; reason: string | null };

const monetaryScale: Partial<Record<FinancialStatementObservation["unit"], number>> = { ones: 1, thousands: 1_000, lakhs: 100_000, millions: 1_000_000, crores: 10_000_000, billions: 1_000_000_000, trillions: 1_000_000_000_000 };

/** Converts explicitly declared units to absolute source-currency values. Percent, share and per-share records are never scaled as money. */
export function normalizeFinancialValue(value: number | null | undefined, unit: FinancialStatementObservation["unit"] | null | undefined, kind: FinancialValueKind = "monetary"): NormalizedFinancialValue {
  if (!finite(value)) return { value: null, originalUnit: unit || null, normalizedUnit: null, reason: "No finite sourced value is available.", methodology: "No normalization was applied." };
  if (!unit) return { value: null, originalUnit: null, normalizedUnit: null, reason: "The source unit is missing.", methodology: "Unknown units are rejected." };
  if (kind === "monetary") { const scale = monetaryScale[unit]; return scale ? { value: value * scale, originalUnit: unit, normalizedUnit: "ones", reason: null, methodology: `${unit} converted to absolute source-currency units.` } : { value: null, originalUnit: unit, normalizedUnit: null, reason: `${unit} is not a monetary unit.`, methodology: "Percentages, shares, and per-share values are not treated as money." }; }
  const requiredUnit = kind === "percentage" ? "percent" : kind === "shares" ? "shares" : "per_share";
  return unit === requiredUnit ? { value, originalUnit: unit, normalizedUnit: requiredUnit, reason: null, methodology: `${requiredUnit} values retain their original scale.` } : { value: null, originalUnit: unit, normalizedUnit: null, reason: `Expected ${requiredUnit}; received ${unit}.`, methodology: "Incompatible units are not converted." };
}

const flowKeys = ["revenue", "revenueFromOperations", "totalIncome", "grossProfit", "ebitda", "ebit", "operatingProfit", "netProfit", "profitAfterTax", "profitAttributable", "operatingCashFlow", "capitalExpenditure", "capex"];

/** Constructs TTM only from four discrete, consecutive, same-currency quarter disclosures available by the requested point in time. */
export function buildTtmFinancials(rows: FinancialStatementObservation[], options: { scope?: FinancialStatementObservation["scope"]; asOf?: string } = {}): TtmFinancialResult {
  const scope = options.scope || "consolidated"; const asOf = options.asOf ? Date.parse(options.asOf) : Infinity;
  const quarterly = normalizeFinancialStatements(rows).filter((row) => (row.statement === "income" || row.statement === "cash_flow") && row.scope === scope && row.periodType === "quarterly" && !row.cumulative && Date.parse(row.publishedAt) <= asOf);
  const currencies = [...new Set(quarterly.map((row) => row.currency))];
  if (currencies.length > 1) return { available: false, reason: "TTM cannot combine incompatible currencies without an authorized FX source.", scope, currency: null, quarters: [], values: {}, sourceUrls: [], latestPublishedAt: null, methodology: "Rejected mixed-currency quarters." };
  const byEnd = new Map<string, FinancialStatementObservation[]>(); for (const row of quarterly) { const current = byEnd.get(row.periodEnd) || []; current.push(row); byEnd.set(row.periodEnd, current); }
  const ends = [...byEnd.keys()].sort(); const chosenEnds = ends.slice(-4); if (chosenEnds.length !== 4) return { available: false, reason: "TTM requires four distinct sourced discrete quarters.", scope, currency: currencies[0] || null, quarters: [], values: {}, sourceUrls: [], latestPublishedAt: null, methodology: "No missing quarter is inferred." };
  const periods = chosenEnds.map((end) => byEnd.get(end)!); const gapDays = chosenEnds.slice(1).map((end, index) => (Date.parse(end) - Date.parse(chosenEnds[index])) / 86_400_000);
  if (gapDays.some((days) => days < 70 || days > 115)) return { available: false, reason: "TTM requires four consecutive quarterly reporting periods.", scope, currency: currencies[0] || null, quarters: [], values: {}, sourceUrls: [], latestPublishedAt: null, methodology: "Non-consecutive fiscal periods are not aggregated." };
  const selected = periods.flatMap((period) => period); const units = [...new Set(selected.map((row) => row.unit))]; if (units.some((unit) => !monetaryScale[unit])) return { available: false, reason: "TTM flow records require explicit compatible monetary units.", scope, currency: currencies[0] || null, quarters: selected, values: {}, sourceUrls: [], latestPublishedAt: null, methodology: "Percent/share/per-share records are not summed as monetary flows." };
  const values: Record<string, number | null> = {};
  for (const key of flowKeys) { const inputs = periods.map((period) => period.map((row) => ({ row, value: financialValue(row, key) })).find((item) => finite(item.value))); if (inputs.length === 4 && inputs.every((item) => item && finite(item.value))) { const normalized = inputs.map((item) => normalizeFinancialValue(item!.value, item!.row.unit)); values[key] = normalized.every((item) => finite(item.value)) ? normalized.reduce((sum, item) => sum + item.value!, 0) : null; } else values[key] = null; }
  return { available: true, reason: null, scope, currency: currencies[0] || null, quarters: selected, values, sourceUrls: [...new Set(selected.map((row) => row.sourceUrl))], latestPublishedAt: selected.map((row) => row.publishedAt).sort().at(-1) || null, methodology: "Four discrete, consecutive quarter disclosures are converted to absolute source-currency units and summed only for flow metrics. Balance-sheet values are excluded." };
}

/** Reconciles only mutually-exclusive shareholding categories and flags parent/subcategory overlap instead of forcing totals to 100%. */
export function reconcileShareholding(rows: FinancialStatementObservation[], options: { scope?: FinancialStatementObservation["scope"] } = {}): ShareholdingReconciliation {
  const scope = options.scope || "consolidated"; const statements = compatibleStatements(rows, "shareholding", scope, "quarterly"); const current = statements.at(-1); const prior = statements.at(-2);
  if (!current) return { available: false, periodEnd: null, reportedTotalPct: null, reconciliationDifferencePct: null, status: "unavailable", categories: [], sourceUrls: [], reason: "No compatible sourced shareholding disclosure is available." };
  const mapping: Array<[string, string | null, string[]]> = [["Promoter and promoter group", null, ["promoterAndPromoterGroupPct", "promoterHoldingPct"]], ["FII/FPI", "Institutional", ["fiiPct", "fpiPct"]], ["DII", "Institutional", ["diiPct"]], ["Mutual funds", "DII", ["mutualFundsPct"]], ["Insurance companies", "DII", ["insurancePct"]], ["Government", null, ["governmentPct"]], ["Retail investors", "Public", ["retailPct"]], ["Other public", "Public", ["otherPublicPct"]], ["Promoter pledged shares", "Promoter and promoter group", ["promoterPledgedPct"]]];
  const get = (row: FinancialStatementObservation | undefined, keys: string[]) => keys.map((key) => financialValue(row, key)).find(finite) ?? null;
  const categories = mapping.map(([category, parentCategory, keys]) => { const value = get(current, keys); const priorValue = get(prior, keys); return { category, parentCategory, valuePct: value, priorValuePct: priorValue, changePp: finite(value) && finite(priorValue) ? value - priorValue : null, overlapping: parentCategory === "DII" && (category === "Mutual funds" || category === "Insurance companies") && finite(get(current, ["diiPct"])) }; });
  const totalCategories = categories.filter((item) => !item.parentCategory && item.category !== "Promoter pledged shares" && finite(item.valuePct)); const total = totalCategories.reduce((sum, item) => sum + item.valuePct!, 0); const hasOverlap = categories.some((item) => item.overlapping); const status = hasOverlap ? "overlapping" : totalCategories.length < 2 ? "incomplete" : Math.abs(total - 100) <= 0.5 ? "reconciled" : "incomplete";
  return { available: true, periodEnd: current.periodEnd, reportedTotalPct: totalCategories.length ? total : null, reconciliationDifferencePct: totalCategories.length ? 100 - total : null, status, categories, sourceUrls: [...new Set([current, prior].filter(Boolean).map((row) => row!.sourceUrl))], reason: status === "reconciled" ? null : status === "overlapping" ? "Parent and subcategory disclosures overlap; they are not summed." : "The source disclosure is incomplete or does not reconcile within the documented 0.5 percentage-point rounding tolerance." };
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const latest = <T extends { asOf: string }>(items: T[]) => [...items].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf)).at(-1);
const ratio = (numerator?: number, denominator?: number) => finite(numerator) && finite(denominator) && denominator !== 0 ? numerator / denominator : null;

export function normalizeChartSeries(rows: MarketObservation[]): ChartPoint[] {
  const unique = new Map<string, MarketObservation>();
  for (const row of rows) {
    if (!finite(row.close) || row.close <= 0 || Number.isNaN(Date.parse(row.asOf)) || unique.has(row.asOf)) continue;
    const high = finite(row.high) ? row.high : row.close;
    const low = finite(row.low) ? row.low : row.close;
    // An OHLC row that cannot contain its close is not a usable market observation.
    if (high <= 0 || low <= 0 || high < low || high < row.close || low > row.close) continue;
    unique.set(row.asOf, row);
  }
  return [...unique.values()].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf)).map((row) => ({ time: row.asOf, open: row.close, high: finite(row.high) ? row.high : row.close, low: finite(row.low) ? row.low : row.close, close: row.close, volume: finite(row.volume) && row.volume >= 0 ? row.volume : null }));
}

const chartDays: Record<Exclude<ChartRange, "MAX">, number> = { "1D": 1, "1W": 7, "1M": 31, "3M": 92, "6M": 184, "1Y": 366, "3Y": 1096, "5Y": 1827 };
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const standardDeviation = (values: number[]) => { const mean = average(values); return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length); };

/** Applies display ranges to ordered observations without creating missing sessions. */
export function selectChartRange(points: ChartPoint[], range: ChartRange): ChartPoint[] {
  if (!points.length || range === "MAX") return points;
  const latestTime = Date.parse(points.at(-1)!.time); const days = chartDays[range];
  return points.filter((point) => Date.parse(point.time) >= latestTime - days * 86_400_000);
}

/** Daily source rows may only aggregate into week/month buckets; intraday is never synthesized. */
export function aggregateChartInterval(points: ChartPoint[], interval: CandleInterval) {
  if (["1m", "5m", "15m", "30m", "1h"].includes(interval)) return { points: [], available: false, reason: "Intraday candles require an authorized intraday source; daily observations are not converted to intraday data." };
  if (interval === "1d") return { points, available: true, reason: null };
  const buckets = new Map<string, ChartPoint[]>();
  for (const point of points) { const date = new Date(`${point.time}T00:00:00Z`); const key = interval === "1w" ? `${date.getUTCFullYear()}-${Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 1)) / 604_800_000)}` : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; const values = buckets.get(key) || []; values.push(point); buckets.set(key, values); }
  return { points: [...buckets.values()].map((rows) => ({ time: rows[0]!.time, open: rows[0]!.open, high: Math.max(...rows.map((row) => row.high)), low: Math.min(...rows.map((row) => row.low)), close: rows.at(-1)!.close, volume: rows.some((row) => row.volume !== null) ? rows.reduce((sum, row) => sum + (row.volume || 0), 0) : null })), available: true, reason: null };
}

function movingAverage(points: ChartPoint[], period: number, exponential = false) {
  const result: Array<{ time: string; value: number }> = []; let previous: number | null = null; const multiplier = 2 / (period + 1);
  for (let index = 0; index < points.length; index += 1) { if (index + 1 < period) continue; const seed = average(points.slice(index + 1 - period, index + 1).map((point) => point.close)); const value: number = exponential ? (previous === null ? seed : points[index]!.close * multiplier + previous * (1 - multiplier)) : seed; previous = value; result.push({ time: points[index]!.time, value }); }
  return result;
}

/** Timestamp-aligned indicator series. A series begins only after its mathematical warm-up period. */
export function buildChartTechnicalSeries(points: ChartPoint[]): ChartTechnicalSeries {
  const sma20 = movingAverage(points, 20); const sma50 = movingAverage(points, 50); const sma100 = movingAverage(points, 100); const sma200 = movingAverage(points, 200); const ema12 = movingAverage(points, 12, true); const ema26 = movingAverage(points, 26, true); const ema50 = movingAverage(points, 50, true); const ema200 = movingAverage(points, 200, true);
  const bollinger = points.flatMap((point, index) => { if (index + 1 < 20) return []; const values = points.slice(index + 1 - 20, index + 1).map((item) => item.close); const middle = average(values); const deviation = standardDeviation(values); return [{ time: point.time, upper: middle + 2 * deviation, middle, lower: middle - 2 * deviation }]; });
  const rsi14 = points.flatMap((point, index) => { if (index < 14) return []; const changes = points.slice(index - 14, index + 1).slice(1).map((item, changeIndex) => item.close - points[index - 14 + changeIndex]!.close); const gains = average(changes.map((value) => Math.max(value, 0))); const losses = average(changes.map((value) => Math.max(-value, 0))); return [{ time: point.time, value: losses === 0 ? 100 : 100 - 100 / (1 + gains / losses) }]; });
  const macdRaw = points.flatMap((point, index) => { const twelve = ema12.find((item) => item.time === point.time); const twentySix = ema26.find((item) => item.time === point.time); return twelve && twentySix ? [{ time: point.time, value: twelve.value - twentySix.value }] : []; });
  const macd = macdRaw.map((item, index) => { const signalValues = macdRaw.slice(0, index + 1); const signal = signalValues.length < 9 ? null : movingAverage(signalValues.map((value) => ({ time: value.time, open: value.value, high: value.value, low: value.value, close: value.value, volume: null })), 9, true).at(-1)?.value ?? null; return { time: item.time, macd: item.value, signal, histogram: signal === null ? null : item.value - signal }; });
  const requirements: Array<[string, number]> = [["SMA 20", 20], ["SMA 50", 50], ["SMA 100", 100], ["SMA 200", 200], ["EMA 12", 12], ["EMA 26", 26], ["EMA 50", 50], ["EMA 200", 200], ["Bollinger Bands", 20], ["RSI 14", 15], ["MACD", 34]];
  const availability: ChartTechnicalSeries["availability"] = Object.fromEntries(requirements.map(([name, minimumObservations]) => [name, { available: points.length >= minimumObservations, minimumObservations, reason: points.length >= minimumObservations ? null : `Requires ${minimumObservations} sourced observations.` }]));
  return { sma20, sma50, sma100, sma200, ema12, ema26, ema50, ema200, bollinger, rsi14, macd, availability };
}

/** Normalizes a return-only comparison to 100 at the first compatible date. */
export function normalizeBenchmarkComparison(primary: ChartPoint[], benchmark: ChartPoint[]) {
  const primaryByDate = new Map(primary.map((point) => [point.time, point.close])); const benchmarkByDate = new Map(benchmark.map((point) => [point.time, point.close])); const dates = [...primaryByDate.keys()].filter((date) => benchmarkByDate.has(date)).sort();
  if (dates.length < 2) return { available: false, reason: "At least two compatible source dates are required for a benchmark comparison.", points: [] as Array<{ time: string; primary: number; benchmark: number }> };
  const firstPrimary = primaryByDate.get(dates[0])!; const firstBenchmark = benchmarkByDate.get(dates[0])!;
  if (firstPrimary <= 0 || firstBenchmark <= 0) return { available: false, reason: "Comparison base observations must be positive.", points: [] as Array<{ time: string; primary: number; benchmark: number }> };
  return { available: true, reason: null, points: dates.map((time) => ({ time, primary: primaryByDate.get(time)! / firstPrimary * 100, benchmark: benchmarkByDate.get(time)! / firstBenchmark * 100 })) };
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

const financialValue = (row: FinancialStatementObservation | undefined, ...keys: string[]) => {
  if (!row) return null;
  for (const key of keys) if (finite(row.values[key])) return row.values[key] as number;
  return null;
};
const compatibleStatements = (rows: FinancialStatementObservation[], statement: FinancialStatementObservation["statement"], scope: FinancialStatementObservation["scope"], periodType: FinancialStatementObservation["periodType"]) => normalizeFinancialStatements(rows).filter((row) => row.statement === statement && row.scope === scope && row.periodType === periodType);
const latestStatement = (rows: FinancialStatementObservation[], statement: FinancialStatementObservation["statement"], scope: FinancialStatementObservation["scope"], periodType: FinancialStatementObservation["periodType"]) => compatibleStatements(rows, statement, scope, periodType).at(-1);
const previousStatement = (rows: FinancialStatementObservation[], statement: FinancialStatementObservation["statement"], scope: FinancialStatementObservation["scope"], periodType: FinancialStatementObservation["periodType"]) => compatibleStatements(rows, statement, scope, periodType).at(-2);
const percentChange = (current: number | null, prior: number | null) => finite(current) && finite(prior) && prior !== 0 ? (current / prior - 1) * 100 : null;
const averageBalance = (current: number | null, prior: number | null) => finite(current) && finite(prior) ? (current + prior) / 2 : null;
const validPositiveRatio = (numerator: number | null, denominator: number | null) => finite(numerator) && finite(denominator) && denominator > 0 ? numerator / denominator : null;
const cagr = (points: Array<{ periodEnd: string; value: number }>, minimumYears: number) => {
  const eligible = points.filter((point) => finite(point.value) && point.value > 0).sort((a, b) => Date.parse(a.periodEnd) - Date.parse(b.periodEnd));
  const first = eligible.at(0); const lastPoint = eligible.at(-1);
  if (!first || !lastPoint || first === lastPoint) return null;
  const years = (Date.parse(lastPoint.periodEnd) - Date.parse(first.periodEnd)) / (365.2425 * 86_400_000);
  return years >= minimumYears && first.value > 0 ? ((lastPoint.value / first.value) ** (1 / years) - 1) * 100 : null;
};

/**
 * A strict, denominator-safe financial calculation layer. All ratios use one
 * reporting scope and period type; return metrics require two compatible
 * balance-sheet disclosures, so closing balances are never silently used.
 */
export function calculateAdvancedFinancialMetrics(rows: FinancialStatementObservation[], options: { scope?: FinancialStatementObservation["scope"]; periodType?: FinancialStatementObservation["periodType"] } = {}) {
  const scope = options.scope || "consolidated"; const periodType = options.periodType || "annual";
  const income = latestStatement(rows, "income", scope, periodType); const priorIncome = previousStatement(rows, "income", scope, periodType);
  const balance = latestStatement(rows, "balance_sheet", scope, periodType); const priorBalance = previousStatement(rows, "balance_sheet", scope, periodType);
  const cash = latestStatement(rows, "cash_flow", scope, periodType); const priorCash = previousStatement(rows, "cash_flow", scope, periodType);
  const dividend = latestStatement(rows, "dividend", scope, periodType); const priorDividend = previousStatement(rows, "dividend", scope, periodType);
  const value = (row: FinancialStatementObservation | undefined, ...keys: string[]) => financialValue(row, ...keys);
  const revenue = value(income, "revenue", "revenueFromOperations", "totalIncome"); const priorRevenue = value(priorIncome, "revenue", "revenueFromOperations", "totalIncome");
  const grossProfit = value(income, "grossProfit"); const ebitda = value(income, "ebitda"); const ebit = value(income, "ebit", "operatingProfit"); const netProfit = value(income, "netProfit", "profitAfterTax", "profitAttributable"); const eps = value(income, "eps", "basicEps"); const taxExpense = value(income, "taxExpense", "incomeTaxExpense"); const profitBeforeTax = value(income, "profitBeforeTax", "pbt");
  const assets = value(balance, "totalAssets"); const priorAssets = value(priorBalance, "totalAssets"); const equity = value(balance, "totalEquity", "equity"); const priorEquity = value(priorBalance, "totalEquity", "equity"); const debt = value(balance, "interestBearingDebt", "totalDebt", "borrowings"); const liabilities = value(balance, "totalLiabilities"); const currentAssets = value(balance, "currentAssets"); const currentLiabilities = value(balance, "currentLiabilities"); const inventory = value(balance, "inventory"); const cashAndEquivalents = value(balance, "cashAndCashEquivalents", "cash"); const restrictedCash = value(balance, "restrictedCash"); const shortTermInvestments = value(balance, "shortTermInvestments"); const preferredEquity = value(balance, "preferredEquity"); const nonControllingInterest = value(balance, "nonControllingInterest");
  const operatingCashFlow = value(cash, "operatingCashFlow"); const priorOperatingCashFlow = value(priorCash, "operatingCashFlow"); const capex = value(cash, "capitalExpenditure", "capex"); const priorCapex = value(priorCash, "capitalExpenditure", "capex"); const fcf = finite(operatingCashFlow) && finite(capex) ? operatingCashFlow - Math.abs(capex) : null; const priorFcf = finite(priorOperatingCashFlow) && finite(priorCapex) ? priorOperatingCashFlow - Math.abs(priorCapex) : null;
  const marketPrice = value(income, "marketPrice", "lastPrice") ?? value(balance, "marketPrice", "lastPrice"); const marketCap = value(income, "marketCapitalization", "marketCap") ?? value(balance, "marketCapitalization", "marketCap"); const shares = value(income, "sharesOutstanding", "weightedAverageShares") ?? value(balance, "sharesOutstanding");
  const dividendPerShare = value(dividend, "dividendPerShare", "dps"); const priorDividendPerShare = value(priorDividend, "dividendPerShare", "dps");
  const cashEligible = finite(cashAndEquivalents) && finite(restrictedCash) ? cashAndEquivalents - restrictedCash : cashAndEquivalents;
  // EV is intentionally unavailable until every required component is sourced.
  const enterpriseValue = finite(marketCap) && finite(debt) && finite(preferredEquity) && finite(nonControllingInterest) && finite(cashEligible) ? marketCap + debt + preferredEquity + nonControllingInterest - cashEligible : null;
  const averageEquity = averageBalance(equity, priorEquity); const averageAssets = averageBalance(assets, priorAssets); const capitalEmployed = finite(assets) && finite(currentLiabilities) ? assets - currentLiabilities : null; const priorCapitalEmployed = finite(priorAssets) && finite(value(priorBalance, "currentLiabilities")) ? priorAssets - value(priorBalance, "currentLiabilities")! : null; const averageCapitalEmployed = averageBalance(capitalEmployed, priorCapitalEmployed); const investedCapital = finite(debt) && finite(equity) && finite(cashEligible) ? debt + equity - cashEligible : null; const priorInvestedCapital = finite(value(priorBalance, "interestBearingDebt", "totalDebt", "borrowings")) && finite(priorEquity) && finite(value(priorBalance, "cashAndCashEquivalents", "cash")) ? value(priorBalance, "interestBearingDebt", "totalDebt", "borrowings")! + priorEquity - value(priorBalance, "cashAndCashEquivalents", "cash")! : null; const averageInvestedCapital = averageBalance(investedCapital, priorInvestedCapital);
  const effectiveTaxRate = finite(taxExpense) && finite(profitBeforeTax) && profitBeforeTax > 0 ? taxExpense / profitBeforeTax : null; const nopat = finite(ebit) && finite(effectiveTaxRate) ? ebit * (1 - effectiveTaxRate) : null;
  const revenueTrend = buildFinancialTrend(rows, "revenue", { statement: "income", scope, periodType });
  const metric = (key: string, label: string, value: number | null, formula: string, statement?: FinancialStatementObservation, source: "reported" | "derived" = "derived", reason?: string) => ({ key, label, value, formula, source, periodEnd: statement?.periodEnd || null, publishedAt: statement?.publishedAt || null, currency: statement?.currency || null, unit: statement?.unit || null, sourceUrl: statement?.sourceUrl || null, reason: value === null ? reason || "Compatible sourced inputs are unavailable or not meaningful." : null });
  const metrics = [
    metric("grossProfitMargin", "Gross profit margin", validPositiveRatio(grossProfit, revenue) === null ? null : validPositiveRatio(grossProfit, revenue)! * 100, "Gross profit ÷ revenue", income),
    metric("roe", "ROE", validPositiveRatio(netProfit, averageEquity) === null ? null : validPositiveRatio(netProfit, averageEquity)! * 100, "Net profit ÷ average total equity", income, "derived", "Requires compatible current and prior total equity."),
    metric("roa", "ROA", validPositiveRatio(netProfit, averageAssets) === null ? null : validPositiveRatio(netProfit, averageAssets)! * 100, "Net profit ÷ average total assets", income, "derived", "Requires compatible current and prior total assets."),
    metric("roce", "ROCE", validPositiveRatio(ebit, averageCapitalEmployed) === null ? null : validPositiveRatio(ebit, averageCapitalEmployed)! * 100, "EBIT ÷ average (total assets − current liabilities)", income, "derived", "Requires compatible current and prior capital employed."),
    metric("roic", "ROIC", validPositiveRatio(nopat, averageInvestedCapital) === null ? null : validPositiveRatio(nopat, averageInvestedCapital)! * 100, "NOPAT ÷ average (interest-bearing debt + equity − eligible cash)", income, "derived", "Requires EBIT, tax expense, PBT, and current/prior invested capital."),
    metric("quickRatio", "Quick ratio", finite(currentAssets) && finite(inventory) && finite(currentLiabilities) && currentLiabilities > 0 ? (currentAssets - inventory) / currentLiabilities : null, "(Current assets − inventory) ÷ current liabilities", balance),
    metric("currentRatio", "Current ratio", validPositiveRatio(currentAssets, currentLiabilities), "Current assets ÷ current liabilities", balance),
    metric("cashRatio", "Cash ratio", validPositiveRatio(cashAndEquivalents, currentLiabilities), "Cash and cash equivalents ÷ current liabilities", balance),
    metric("debtToEquity", "Debt/equity", validPositiveRatio(debt, equity), "Interest-bearing debt ÷ total equity", balance),
    metric("debtToAssets", "Debt/assets", validPositiveRatio(debt, assets), "Interest-bearing debt ÷ total assets", balance),
    metric("netDebt", "Net debt", finite(debt) && finite(cashEligible) ? debt - cashEligible : null, "Interest-bearing debt − eligible cash", balance),
    metric("netDebtToEbitda", "Net debt/EBITDA", finite(debt) && finite(cashEligible) && finite(ebitda) && ebitda > 0 ? (debt - cashEligible) / ebitda : null, "Net debt ÷ EBITDA", balance),
    metric("financialLeverage", "Financial leverage", validPositiveRatio(averageAssets, averageEquity), "Average total assets ÷ average total equity", balance, "derived", "Requires compatible current and prior assets and equity."),
    metric("workingCapital", "Working capital", finite(currentAssets) && finite(currentLiabilities) ? currentAssets - currentLiabilities : null, "Current assets − current liabilities", balance),
    metric("operatingCashFlow", "Operating cash flow", operatingCashFlow, "Reported cash-flow value", cash, "reported"),
    metric("freeCashFlow", "Free cash flow", fcf, "Operating cash flow − absolute capex outflow", cash, "derived"),
    metric("bookValuePerShare", "Book value per share", validPositiveRatio(equity, shares), "Total equity ÷ shares outstanding", balance),
    metric("marketCapitalization", "Market capitalization", marketCap, "Sourced market capitalization", income, "reported"),
    metric("enterpriseValue", "Enterprise value", enterpriseValue, "Market capitalization + debt + preferred equity + NCI − eligible cash", balance, "derived", "Requires all enterprise-value components; missing components are not assumed to be zero."),
    metric("pe", "P/E", finite(marketPrice) && finite(eps) && eps > 0 ? marketPrice / eps : null, "Market price ÷ EPS", income, "derived", "Requires a positive sourced EPS and compatible market price."),
    metric("pb", "P/B", finite(marketPrice) && finite(equity) && finite(shares) && equity > 0 && shares > 0 ? marketPrice / (equity / shares) : null, "Market price ÷ book value per share", balance),
    metric("ps", "P/S", finite(marketCap) && finite(revenue) && revenue > 0 ? marketCap / revenue : null, "Market capitalization ÷ revenue", income),
    metric("evEbitda", "EV/EBITDA", finite(enterpriseValue) && finite(ebitda) && ebitda > 0 ? enterpriseValue / ebitda : null, "Enterprise value ÷ EBITDA", income),
    metric("evSales", "EV/Sales", finite(enterpriseValue) && finite(revenue) && revenue > 0 ? enterpriseValue / revenue : null, "Enterprise value ÷ revenue", income),
    metric("earningsYield", "Earnings yield", finite(eps) && eps > 0 && finite(marketPrice) && marketPrice > 0 ? eps / marketPrice * 100 : null, "EPS ÷ market price", income),
    metric("freeCashFlowYield", "Free cash flow yield", finite(fcf) && finite(marketCap) && marketCap > 0 ? fcf / marketCap * 100 : null, "Free cash flow ÷ market capitalization", cash),
    metric("dividendPerShare", "Dividend per share", dividendPerShare, "Reported dividend per share", dividend, "reported"),
    metric("dividendYield", "Dividend yield", finite(dividendPerShare) && finite(marketPrice) && marketPrice > 0 ? dividendPerShare / marketPrice * 100 : null, "Dividend per share ÷ sourced market price", dividend, "derived", "Requires a sourced dividend and compatible market price."),
    metric("dividendPayoutRatio", "Dividend payout ratio", finite(dividendPerShare) && finite(eps) && eps > 0 ? dividendPerShare / eps * 100 : null, "Dividend per share ÷ EPS", dividend, "derived", "Requires a positive compatible EPS."),
    metric("dividendGrowth", "Dividend growth", percentChange(dividendPerShare, priorDividendPerShare), "Latest dividend per share ÷ prior dividend per share − 1", dividend),
    metric("revenueGrowth", "Revenue growth", percentChange(revenue, priorRevenue), "Latest compatible revenue ÷ prior period revenue − 1", income),
    metric("ebitdaGrowth", "EBITDA growth", percentChange(ebitda, value(priorIncome, "ebitda")), "Latest compatible EBITDA ÷ prior period EBITDA − 1", income),
    metric("operatingProfitGrowth", "Operating profit growth", percentChange(ebit, value(priorIncome, "ebit", "operatingProfit")), "Latest compatible operating profit ÷ prior period operating profit − 1", income),
    metric("netProfitGrowth", "Net profit growth", percentChange(netProfit, value(priorIncome, "netProfit", "profitAfterTax", "profitAttributable")), "Latest compatible net profit ÷ prior period net profit − 1", income),
    metric("epsGrowth", "EPS growth", percentChange(eps, value(priorIncome, "eps", "basicEps")), "Latest compatible EPS ÷ prior period EPS − 1", income),
    metric("operatingCashFlowGrowth", "Operating cash flow growth", percentChange(operatingCashFlow, priorOperatingCashFlow), "Latest compatible operating cash flow ÷ prior period value − 1", cash),
    metric("freeCashFlowGrowth", "Free cash flow growth", percentChange(fcf, priorFcf), "Latest compatible free cash flow ÷ prior period value − 1", cash),
    metric("debtGrowth", "Debt growth", percentChange(debt, value(priorBalance, "interestBearingDebt", "totalDebt", "borrowings")), "Latest compatible debt ÷ prior period debt − 1", balance),
    metric("threeYearRevenueCagr", "3-year revenue CAGR", cagr(revenueTrend, 3), "(end revenue ÷ start revenue)^(1/years) − 1", income, "derived", "Requires positive sourced revenue endpoints at least three years apart."),
    metric("fiveYearRevenueCagr", "5-year revenue CAGR", cagr(revenueTrend, 5), "(end revenue ÷ start revenue)^(1/years) − 1", income, "derived", "Requires positive sourced revenue endpoints at least five years apart."),
    metric("operatingCashFlowMargin", "Operating cash flow margin", validPositiveRatio(operatingCashFlow, revenue) === null ? null : validPositiveRatio(operatingCashFlow, revenue)! * 100, "Operating cash flow ÷ revenue", cash),
    metric("freeCashFlowMargin", "Free cash flow margin", validPositiveRatio(fcf, revenue) === null ? null : validPositiveRatio(fcf, revenue)! * 100, "Free cash flow ÷ revenue", cash),
  ];
  return { metrics, inputs: { income, balance, cash, dividend }, trends: { revenue: revenueTrend, ebitda: buildFinancialTrend(rows, "ebitda", { statement: "income", scope, periodType }), netProfit: buildFinancialTrend(rows, "netProfit", { statement: "income", scope, periodType }), eps: buildFinancialTrend(rows, "eps", { statement: "income", scope, periodType }), debt: buildFinancialTrend(rows, "totalDebt", { statement: "balance_sheet", scope, periodType }), operatingCashFlow: buildFinancialTrend(rows, "operatingCashFlow", { statement: "cash_flow", scope, periodType }), dividendPerShare: buildFinancialTrend(rows, "dividendPerShare", { statement: "dividend", scope, periodType }), freeCashFlow: compatibleStatements(rows, "cash_flow", scope, periodType).flatMap((row) => { const flow = financialValue(row, "operatingCashFlow"); const expenditure = financialValue(row, "capitalExpenditure", "capex"); return finite(flow) && finite(expenditure) ? [{ periodEnd: row.periodEnd, publishedAt: row.publishedAt, value: flow - Math.abs(expenditure), currency: row.currency, unit: row.unit, sourceUrl: row.sourceUrl, scope: row.scope, periodType: row.periodType }] : []; }) } };
}

/** Sector-gated reported/derived metrics. Industrial ratios are not repurposed for financial institutions. */
export function calculateSectorSpecificMetrics(rows: FinancialStatementObservation[], sector?: string, options: { scope?: FinancialStatementObservation["scope"]; periodType?: FinancialStatementObservation["periodType"] } = {}) {
  const normalizedSector = (sector || "").trim().toLowerCase(); const scope = options.scope || "consolidated"; const periodType = options.periodType || "annual";
  const income = latestStatement(rows, "income", scope, periodType); const balance = latestStatement(rows, "balance_sheet", scope, periodType); const previousIncome = previousStatement(rows, "income", scope, periodType); const previousBalance = previousStatement(rows, "balance_sheet", scope, periodType);
  const read = (row: FinancialStatementObservation | undefined, ...keys: string[]) => financialValue(row, ...keys);
  const item = (key: string, label: string, value: number | null, source: "reported" | "derived" | "not_applicable", formula: string, reason: string | null) => ({ key, label, value, source, formula, reason, periodEnd: (income || balance)?.periodEnd || null, sourceUrl: (income || balance)?.sourceUrl || null });
  const banking = /bank|nbfc|financial services|finance/.test(normalizedSector); const insurance = /insurance/.test(normalizedSector);
  if (!banking && !insurance) return { applicable: false, sector: sector || null, metrics: [item("sectorMetrics", "Sector-specific metrics", null, "not_applicable", "Not applicable", "This issuer is not classified as a banking, NBFC, or insurance business.")] };
  if (banking) {
    const interestIncome = read(income, "interestIncome"); const interestExpense = read(income, "interestExpense", "financeCost"); const earningAssets = read(balance, "averageEarningAssets", "earningAssets"); const grossNpa = read(balance, "grossNpa", "grossNpaPct"); const netNpa = read(balance, "netNpa", "netNpaPct"); const car = read(balance, "capitalAdequacyRatio", "car"); const advances = read(balance, "advances", "creditBook", "aum"); const priorAdvances = read(previousBalance, "advances", "creditBook", "aum"); const deposits = read(balance, "deposits"); const casa = read(balance, "casaRatio"); const operatingExpense = read(income, "operatingExpense"); const operatingIncome = read(income, "operatingIncome");
    return { applicable: true, sector: sector || null, metrics: [item("nim", "Net interest margin", finite(interestIncome) && finite(interestExpense) && finite(earningAssets) && earningAssets > 0 ? (interestIncome - interestExpense) / earningAssets * 100 : null, "derived", "(Interest income − interest expense) ÷ earning assets", "Requires compatible interest income, expense and earning assets."), item("grossNpaRatio", "Gross NPA ratio", grossNpa, "reported", "Officially reported regulatory ratio", "Requires an official reported value."), item("netNpaRatio", "Net NPA ratio", netNpa, "reported", "Officially reported regulatory ratio", "Requires an official reported value."), item("capitalAdequacyRatio", "Capital adequacy ratio", car, "reported", "Officially reported regulatory ratio", "Requires an official reported value."), item("creditGrowth", "Credit/AUM growth", percentChange(advances, priorAdvances), "derived", "Latest compatible advances ÷ prior advances − 1", "Requires compatible advances/AUM records."), item("depositGrowth", "Deposit growth", null, "derived", "Requires current and prior compatible deposits", "Prior deposits are not sourced in this reporting selection."), item("costToIncome", "Cost-to-income ratio", validPositiveRatio(operatingExpense, operatingIncome) === null ? null : validPositiveRatio(operatingExpense, operatingIncome)! * 100, "derived", "Operating expense ÷ operating income", "Requires compatible operating expense and income."), item("casaRatio", "CASA ratio", casa, "reported", "Officially reported CASA ratio", "Requires an official reported value.")] };
  }
  const solvency = read(balance, "solvencyRatio"); const premium = read(income, "grossWrittenPremium", "premium"); const priorPremium = read(previousIncome, "grossWrittenPremium", "premium");
  return { applicable: true, sector: sector || null, metrics: [item("solvencyRatio", "Solvency ratio", solvency, "reported", "Officially reported insurance solvency ratio", "Requires an official reported value."), item("premiumGrowth", "Premium growth", percentChange(premium, priorPremium), "derived", "Latest compatible premium ÷ prior premium − 1", "Requires compatible premium records."), item("claimRatio", "Claim ratio", read(income, "claimRatio"), "reported", "Officially reported claim ratio", "Requires an official reported value."), item("combinedRatio", "Combined ratio", read(income, "combinedRatio"), "reported", "Officially reported combined ratio", "Requires an official reported value."), item("expenseRatio", "Expense ratio", read(income, "expenseRatio"), "reported", "Officially reported expense ratio", "Requires an official reported value.")] };
}

/** Builds source-linked financial metrics from compatible statement rows; it never mixes scopes or invents line items. */
export function buildFinancialWorkspace(rows: FinancialStatementObservation[], options: { scope?: FinancialStatementObservation["scope"]; periodType?: FinancialStatementObservation["periodType"] } = {}) {
  const scope = options.scope || "consolidated"; const periodType = options.periodType || "annual"; const statements = normalizeFinancialStatements(rows).filter((row) => row.scope === scope && row.periodType === periodType);
  const income = latestStatement(statements, "income", scope, periodType); const balance = latestStatement(statements, "balance_sheet", scope, periodType); const cashFlow = latestStatement(statements, "cash_flow", scope, periodType); const advanced = calculateAdvancedFinancialMetrics(rows, { scope, periodType }); const ttm = buildTtmFinancials(rows, { scope }); const shareholding = reconcileShareholding(rows, { scope });
  const revenue = financialValue(income, "revenue", "revenueFromOperations", "totalIncome"); const ebitda = financialValue(income, "ebitda"); const operatingProfit = financialValue(income, "operatingProfit", "ebit"); const netProfit = financialValue(income, "netProfit", "profitAfterTax", "profitAttributable"); const eps = financialValue(income, "eps", "basicEps");
  const assets = financialValue(balance, "totalAssets"); const equity = financialValue(balance, "totalEquity", "equity"); const debt = financialValue(balance, "totalDebt", "borrowings"); const currentAssets = financialValue(balance, "currentAssets"); const currentLiabilities = financialValue(balance, "currentLiabilities"); const financeCost = financialValue(income, "financeCost", "interestExpense"); const operatingCashFlow = financialValue(cashFlow, "operatingCashFlow"); const capex = financialValue(cashFlow, "capitalExpenditure", "capex");
  const metric = (key: string, label: string, value: number | null, formula: string, source: "reported" | "derived", statement?: FinancialStatementObservation) => ({ key, label, value, formula, source, periodEnd: statement?.periodEnd || null, publishedAt: statement?.publishedAt || null, currency: statement?.currency || null, unit: statement?.unit || null, sourceUrl: statement?.sourceUrl || null, reason: value === null ? "Compatible sourced inputs are unavailable." : null });
  const fcf = finite(operatingCashFlow) && finite(capex) ? operatingCashFlow - Math.abs(capex) : null;
  const metrics = [metric("revenue", "Revenue", revenue, "Reported income statement value", "reported", income), metric("ebitda", "EBITDA", ebitda, "Reported income statement value", "reported", income), metric("netProfit", "Net profit", netProfit, "Reported income statement value", "reported", income), metric("eps", "EPS", eps, "Reported income statement value", "reported", income), metric("ebitdaMargin", "EBITDA margin", finite(ebitda) && finite(revenue) && revenue > 0 ? ebitda / revenue * 100 : null, "EBITDA ÷ revenue", "derived", income), metric("operatingMargin", "Operating margin", finite(operatingProfit) && finite(revenue) && revenue > 0 ? operatingProfit / revenue * 100 : null, "Operating profit ÷ revenue", "derived", income), metric("netMargin", "Net margin", finite(netProfit) && finite(revenue) && revenue > 0 ? netProfit / revenue * 100 : null, "Net profit ÷ revenue", "derived", income), metric("debtToEquity", "Debt/equity", finite(debt) && finite(equity) && equity > 0 ? debt / equity : null, "Interest-bearing debt ÷ total equity", "derived", balance), metric("currentRatio", "Current ratio", finite(currentAssets) && finite(currentLiabilities) && currentLiabilities > 0 ? currentAssets / currentLiabilities : null, "Current assets ÷ current liabilities", "derived", balance), metric("interestCoverage", "Interest coverage", finite(operatingProfit) && finite(financeCost) && financeCost > 0 ? operatingProfit / financeCost : null, "Operating profit ÷ finance cost", "derived", income), metric("operatingCashFlow", "Operating cash flow", operatingCashFlow, "Reported cash-flow value", "reported", cashFlow), metric("freeCashFlow", "Free cash flow", fcf, "Operating cash flow − absolute capex outflow", "derived", cashFlow)];
  const existing = new Set(metrics.map((item) => item.key)); const advancedMetrics = advanced.metrics.filter((item) => !existing.has(item.key));
  const trends = advanced.trends;
  return { scope, periodType, statements, metrics: [...metrics, ...advancedMetrics], trends, ttm, shareholding, sourceUrls: [...new Set(statements.map((row) => row.sourceUrl))], latestPublishedAt: statements.map((row) => row.publishedAt).sort().at(-1) || null, limitation: statements.length ? null : "No compatible authorized financial statements are available for this reporting basis and period." };
}

export function buildMarketOverview(indices: MarketIndexObservation[], instruments: MarketInstrument[], options: { exchange?: "NSE" | "BSE"; session?: MarketSession; sessionSourceUrl?: string | null; sessionAsOf?: string | null } = {}) {
  const selected = options.exchange ? instruments.filter((instrument) => instrument.exchange === options.exchange) : instruments;
  const indexCards = (["NIFTY 50", "SENSEX", "NIFTY BANK", "INDIA VIX"] as MarketIndex[]).map((index) => {
    const history = [...indices.filter((item) => item.index === index)].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf)); const row = history.at(-1); const prior = history.at(-2);
    const previousClose = finite(row?.previousClose) ? row.previousClose : prior?.value;
    return row ? { index, available: true, value: row.value, previousClose: previousClose ?? null, open: row.open ?? null, high: row.high ?? null, low: row.low ?? null, change: finite(previousClose) ? row.value - previousClose : null, changePct: finite(previousClose) && previousClose ? (row.value / previousClose - 1) * 100 : null, asOf: row.asOf, classification: row.classification, freshness: row.freshness || "unknown", sourceUrl: row.sourceUrl, trend: history.slice(-20).map((item) => ({ asOf: item.asOf, value: item.value })) } : { index, available: false, value: null, previousClose: null, open: null, high: null, low: null, change: null, changePct: null, asOf: null, classification: "unavailable", freshness: "unknown", sourceUrl: null, trend: [] };
  });
  const movers: MarketMover[] = selected.flatMap((instrument) => { const rows = normalizeChartSeries(instrument.observations); const row = rows.at(-1); const previous = rows.at(-2); if (!row || !previous || !finite(row.close) || !finite(previous.close) || previous.close <= 0) return []; const raw = latest(instrument.observations.filter((item) => item.asOf === row.time)); return [{ instrumentId: instrument.instrumentId, companyName: instrument.companyName, symbol: instrument.symbol, exchange: instrument.exchange, close: row.close, previousClose: previous.close, change: row.close - previous.close, changePct: (row.close / previous.close - 1) * 100, volume: row.volume, turnover: row.volume === null ? null : row.volume * row.close, asOf: row.time, sourceUrl: raw?.sourceUrl || "" }]; });
  const comparator = (direction: 1 | -1) => (a: MarketMover, b: MarketMover) => direction * (b.changePct - a.changePct) || a.symbol.localeCompare(b.symbol);
  const advancing = movers.filter((item) => item.changePct > 0).length; const declining = movers.filter((item) => item.changePct < 0).length; const unchanged = movers.length - advancing - declining;
  const validCloseRows = selected.filter((instrument) => normalizeChartSeries(instrument.observations).length > 0).length;
  const latestAsOf = movers.map((item) => item.asOf).sort().at(-1) || indexCards.find((item) => item.asOf)?.asOf || null;
  const calendarLowHigh = (direction: "high" | "low") => selected.flatMap((instrument) => { const rows = normalizeChartSeries(instrument.observations); const row = rows.at(-1); if (!row) return []; const cutoff = Date.parse(row.time) - 365 * 86_400_000; const year = rows.filter((item) => Date.parse(item.time) >= cutoff); if (year.length < 2) return []; const extreme = direction === "high" ? Math.max(...year.map((item) => item.high)) : Math.min(...year.map((item) => item.low)); return (direction === "high" ? row.high >= extreme : row.low <= extreme) ? [{ instrumentId: instrument.instrumentId, companyName: instrument.companyName, symbol: instrument.symbol, exchange: instrument.exchange, close: row.close, previousClose: row.close, change: 0, changePct: 0, volume: row.volume, turnover: row.volume === null ? null : row.volume * row.close, asOf: row.time, sourceUrl: "" } satisfies MarketMover] : []; });
  return { indexCards, marketStatus: options.session || "unknown" as MarketSession, marketStatusSourceUrl: options.sessionSourceUrl || null, marketStatusAsOf: options.sessionAsOf || null, asOf: latestAsOf,
    breadth: { scope: options.exchange ? `${options.exchange} workspace` : "workspace", advancing, declining, unchanged, eligibleComparisons: movers.length, unavailableComparisons: selected.length - movers.length, validCloseRows, coveragePct: selected.length ? movers.length / selected.length * 100 : null, advanceDeclineRatio: declining ? advancing / declining : null },
    topGainers: [...movers].sort(comparator(1)).slice(0, 5), topLosers: [...movers].sort(comparator(-1)).slice(0, 5), mostActive: [...movers].filter((item) => finite(item.volume)).sort((a, b) => b.volume! - a.volume! || a.symbol.localeCompare(b.symbol)).slice(0, 5), volumeLeaders: [...movers].filter((item) => finite(item.volume)).sort((a, b) => b.volume! - a.volume! || a.symbol.localeCompare(b.symbol)).slice(0, 5), turnoverLeaders: [...movers].filter((item) => finite(item.turnover)).sort((a, b) => b.turnover! - a.turnover! || a.symbol.localeCompare(b.symbol)).slice(0, 5), fiftyTwoWeekHighs: calendarLowHigh("high").sort((a, b) => b.volume! - a.volume!), fiftyTwoWeekLows: calendarLowHigh("low").sort((a, b) => b.volume! - a.volume!), universeSize: selected.length };
}

const percentGrowth = (newer?: number, older?: number) => finite(newer) && finite(older) && older !== 0 ? (newer / older - 1) * 100 : null;
const annualizedVolatility = (rows: MarketObservation[]) => {
  const closes = normalizeChartSeries(rows).map((row) => row.close);
  if (closes.length < 3) return null;
  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]!)).filter(Number.isFinite);
  if (returns.length < 2) return null;
  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
};

/** Converts only sourced observations into a row suitable for an authenticated screener response. */
export function buildScreenerRows(instruments: MarketInstrument[]): ScreenerRow[] {
  return instruments.map((instrument) => {
    const orderedFundamentals = [...instrument.fundamentals].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf));
    const fundamental = orderedFundamentals.at(-1); const previousFundamental = orderedFundamentals.at(-2);
    const series = normalizeChartSeries(instrument.observations); const observation = series.at(-1); const prior = series.at(-2);
    const statementMetrics = instrument.financialStatements?.length ? calculateAdvancedFinancialMetrics(instrument.financialStatements, { scope: "consolidated", periodType: "annual" }).metrics : [];
    const statementValue = (key: string) => statementMetrics.find((metric) => metric.key === key)?.value ?? null;
    return { instrumentId: instrument.instrumentId, companyName: instrument.companyName, symbol: instrument.symbol, exchange: instrument.exchange,
      sector: instrument.sector || null, industry: instrument.industry || null, lastPrice: observation?.close ?? null,
      priceChangePct: observation && prior ? percentGrowth(observation.close, prior.close) : null, marketCap: instrument.marketCap ?? null,
      pe: statementValue("pe") ?? fundamental?.pe ?? null, pb: statementValue("pb") ?? fundamental?.pb ?? null, roe: statementValue("roe") ?? fundamental?.roe ?? null, roa: statementValue("roa"), roce: statementValue("roce") ?? fundamental?.roce ?? null, roic: statementValue("roic"),
      debtToEquity: statementValue("debtToEquity") ?? fundamental?.debtToEquity ?? null, currentRatio: statementValue("currentRatio"), quickRatio: statementValue("quickRatio"), dividendYield: statementValue("dividendYield") ?? fundamental?.dividendYield ?? null, freeCashFlowYield: statementValue("freeCashFlowYield"),
      revenueGrowthPct: statementValue("revenueGrowth") ?? percentGrowth(fundamental?.revenue, previousFundamental?.revenue), profitGrowthPct: statementValue("netProfitGrowth") ?? percentGrowth(fundamental?.netProfit, previousFundamental?.netProfit), epsGrowthPct: statementValue("epsGrowth") ?? percentGrowth(fundamental?.eps, previousFundamental?.eps),
      volume: observation?.volume ?? null, momentumPct: series.length >= 2 ? percentGrowth(observation?.close, series[0]?.close) : null,
      volatilityPct: annualizedVolatility(instrument.observations), evidenceCoveragePct: instrument.evidenceCoveragePct,
      lastObservationAt: observation?.time ?? null };
  });
}

const meetsMinimum = (value: number | null, minimum?: number) => !finite(minimum) || (finite(value) && value >= minimum);
const meetsMaximum = (value: number | null, maximum?: number) => !finite(maximum) || (finite(value) && value <= maximum);

export function screenInstruments(instruments: MarketInstrument[], filters: ScreenerFilters = {}) {
  const query = filters.search?.trim().toLowerCase();
  const rows = buildScreenerRows(instruments);
  const matched = rows.filter((row) => {
    const text = `${row.symbol} ${row.companyName} ${row.sector || ""} ${row.industry || ""}`.toLowerCase();
    if (filters.exchange && row.exchange !== filters.exchange) return false; if (filters.sector && row.sector !== filters.sector) return false; if (filters.industry && row.industry !== filters.industry) return false; if (query && !text.includes(query)) return false;
    if (!meetsMinimum(row.marketCap, filters.minMarketCap) || !meetsMaximum(row.marketCap, filters.maxMarketCap) || !meetsMinimum(row.pe, filters.minPe) || !meetsMaximum(row.pe, filters.maxPe) || !meetsMinimum(row.pb, filters.minPb) || !meetsMaximum(row.pb, filters.maxPb)) return false;
    if (!meetsMinimum(row.roe, filters.minRoe) || !meetsMinimum(row.roa, filters.minRoa) || !meetsMinimum(row.roce, filters.minRoce) || !meetsMinimum(row.roic, filters.minRoic) || !meetsMaximum(row.debtToEquity, filters.maxDebtToEquity) || !meetsMinimum(row.currentRatio, filters.minCurrentRatio) || !meetsMinimum(row.quickRatio, filters.minQuickRatio) || !meetsMinimum(row.dividendYield, filters.minDividendYield) || !meetsMinimum(row.freeCashFlowYield, filters.minFreeCashFlowYield)) return false;
    if (!meetsMinimum(row.revenueGrowthPct, filters.minRevenueGrowthPct) || !meetsMinimum(row.profitGrowthPct, filters.minProfitGrowthPct) || !meetsMinimum(row.epsGrowthPct, filters.minEpsGrowthPct)) return false;
    if (!meetsMinimum(row.evidenceCoveragePct, filters.minEvidenceCoveragePct) || !meetsMinimum(row.volume, filters.minVolume) || !meetsMinimum(row.momentumPct, filters.minMomentumPct) || !meetsMaximum(row.volatilityPct, filters.maxVolatilityPct)) return false;
    return true;
  });
  return { results: matched, total: matched.length, universeSize: instruments.length, limitation: instruments.length ? null : "No authorized instrument universe is available for screening." };
}

/** Stable, bounded server-side sort. Unavailable fields are always listed after sourced values. */
export function sortScreenerRows(rows: ScreenerRow[], sort: ScreenerSort = "company", direction: "asc" | "desc" = "asc") {
  const factor = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const field: keyof ScreenerRow = sort === "company" ? "companyName" : sort;
    const left = a[field]; const right = b[field];
    if (left == null && right == null) return a.companyName.localeCompare(b.companyName);
    if (left == null) return 1; if (right == null) return -1;
    const compared = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
    return compared * factor || a.companyName.localeCompare(b.companyName);
  });
}

export function aggregateSectorHeatmap(instruments: MarketInstrument[], options: { exchange?: "NSE" | "BSE" } = {}): SectorPerformance[] {
  const buckets = new Map<string, Array<{ instrument: MarketInstrument; changePct: number; volume: number | null; asOf: string }>>();
  for (const instrument of instruments) { if (options.exchange && instrument.exchange !== options.exchange) continue; const rows = normalizeChartSeries(instrument.observations); if (rows.length < 2 || !instrument.sector) continue; const current = rows.at(-1)!; const previous = rows.at(-2)!; if (previous.close <= 0) continue; const values = buckets.get(instrument.sector) || []; values.push({ instrument, changePct: (current.close / previous.close - 1) * 100, volume: current.volume, asOf: current.time }); buckets.set(instrument.sector, values); }
  return [...buckets.entries()].map(([sector, values]) => {
    const weighted = values.filter((item) => finite(item.instrument.marketCap) && item.instrument.marketCap! > 0); const marketCap = weighted.reduce((sum, item) => sum + item.instrument.marketCap!, 0);
    return { sector, instruments: values.length, eligibleCompanies: values.length, advancing: values.filter((item) => item.changePct > 0.00001).length, declining: values.filter((item) => item.changePct < -0.00001).length, unchanged: values.filter((item) => Math.abs(item.changePct) <= 0.00001).length, unavailableComparisons: instruments.filter((item) => item.sector === sector).length - values.length,
      equalWeightedChangePct: values.reduce((sum, item) => sum + item.changePct, 0) / values.length, marketCapWeightedChangePct: weighted.length ? weighted.reduce((sum, item) => sum + item.changePct * item.instrument.marketCap!, 0) / marketCap : null, aggregateVolume: values.some((item) => finite(item.volume)) ? values.reduce((sum, item) => sum + (item.volume || 0), 0) : null, aggregateMarketCap: weighted.length ? marketCap : null, marketCapCoveragePct: values.length ? weighted.length / values.length * 100 : null, lastRefreshedAt: values.map((item) => item.asOf).sort().at(-1) || null,
      companies: values.map((item) => ({ instrumentId: item.instrument.instrumentId, companyName: item.instrument.companyName, symbol: item.instrument.symbol, exchange: item.instrument.exchange, changePct: item.changePct, marketCap: item.instrument.marketCap ?? null, asOf: item.asOf })).sort((a, b) => b.changePct - a.changePct || a.symbol.localeCompare(b.symbol)) };
  }).sort((a, b) => (b.marketCapWeightedChangePct ?? b.equalWeightedChangePct ?? -Infinity) - (a.marketCapWeightedChangePct ?? a.equalWeightedChangePct ?? -Infinity) || a.sector.localeCompare(b.sector));
}
