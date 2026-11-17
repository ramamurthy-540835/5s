/**
 * Deterministic, point-in-time Stock Intelligence calculations.  This module
 * deliberately has no network client: ingestion is responsible for recording
 * source-attributed observations before this code is called.
 */
export type SourceClass = "verified_filing" | "company_statement" | "analyst_opinion" | "media_report" | "rumor" | "unverified_claim";
export type MarketObservation = { symbol: string; exchange: string; asOf: string; close: number; high?: number; low?: number; volume?: number; niftyClose?: number; sectorClose?: number; indiaVix?: number; usdInr?: number; brent?: number; repoRate?: number; inflation?: number; fiiNetFlow?: number; sourceUrl: string; sourceClass: SourceClass };
export type FundamentalSnapshot = { symbol: string; exchange: string; asOf: string; fiscalPeriod: string; revenue?: number; netProfit?: number; ebitdaMargin?: number; eps?: number; roe?: number; roce?: number; debtToEquity?: number; freeCashFlow?: number; pe?: number; pb?: number; evEbitda?: number; dividendYield?: number; sourceUrl: string; sourceClass: SourceClass };
export type ResearchItem = { symbol: string; exchange: string; publishedAt: string; title: string; summary: string; sourceUrl: string; sourceClass: SourceClass; materiality: "low" | "medium" | "high"; conflicted?: boolean };
export type FinancialStatementObservation = { symbol: string; exchange: string; statement: "income" | "balance_sheet" | "cash_flow" | "shareholding"; scope: "standalone" | "consolidated"; periodType: "quarterly" | "annual" | "ttm"; periodEnd: string; publishedAt: string; currency: string; unit: "ones" | "lakhs" | "crores"; actual: boolean; restated?: boolean; values: Record<string, number | null>; sourceUrl: string; sourceClass: SourceClass };
export type Factor = { id: string; rawValue: number | null; normalizedScore: number | null; direction: "positive" | "negative" | "neutral" | "unavailable"; weight: number; confidence: "high" | "medium" | "low"; freshness: "fresh" | "stale" | "missing"; availability: "available" | "unavailable"; source: string[]; explanation: string };
type Timeframe = "3Y" | "1Y" | "6M" | "3M" | "1M" | "1W" | "1D";
type Horizon = "1W" | "1M" | "3M" | "6M" | "12M";
const DAYS: Record<Timeframe, number> = { "3Y": 1095, "1Y": 365, "6M": 182, "3M": 91, "1M": 30, "1W": 7, "1D": 1 };
const HORIZON_DAYS: Record<Horizon, number> = { "1W": 5, "1M": 21, "3M": 63, "6M": 126, "12M": 252 };
const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
const safeNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : undefined;
const mean = (values: number[]) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
const std = (values: number[]) => values.length > 1 ? Math.sqrt(mean(values.map((value) => (value - mean(values)) ** 2))) : 0;
const ema = (values: number[], period: number) => values.reduce((previous, value, index) => index ? value * (2 / (period + 1)) + previous * (1 - 2 / (period + 1)) : value, 0);
const asDate = (value: string) => new Date(`${value}T00:00:00Z`).getTime();
const dateCutoff = (latest: string, days: number) => asDate(latest) - days * 86_400_000;
const classify = (value: number | null): "positive" | "negative" | "neutral" | "unavailable" => value === null ? "unavailable" : Math.abs(value) < 0.05 ? "neutral" : value > 0 ? "positive" : "negative";
const confidence = (count: number): "high" | "medium" | "low" => count >= 180 ? "high" : count >= 30 ? "medium" : "low";

export function assessRisk(input: { observations: MarketObservation[]; fundamentals: FundamentalSnapshot[]; research: ResearchItem[]; evidenceCoveragePct: number }) {
  const quality = validateStockData({ symbol: input.observations[0]?.symbol || "", exchange: input.observations[0]?.exchange || "", observations: input.observations, fundamentals: input.fundamentals, research: input.research }, new Date());
  const sufficient = input.observations.length >= 30 && input.fundamentals.length >= 1 && input.evidenceCoveragePct >= 50 && !quality.conflictingSources;
  if (!sufficient) return { dataConfidence: confidence(input.observations.length), dataAvailability: input.observations.length ? "partial" : "missing", dataQualityRisk: quality.conflictingSources || quality.stale ? "elevated" : "unknown", businessRisk: "not_assessable", financialRisk: "not_assessable", valuationRisk: "not_assessable", marketRisk: "not_assessable", technicalRisk: "not_assessable", investmentRisk: "not_assessable", reason: "Investment risk is not assessed until sufficient fresh, non-conflicting price, fundamental, and evidence coverage exists." };
  const latest = latestFundamental(input.fundamentals); const oneYear = aggregateTimeframes(input.observations).find((item) => item.timeframe === "1Y");
  return { dataConfidence: confidence(input.observations.length), dataAvailability: "available", dataQualityRisk: "controlled", businessRisk: "not_assessable", financialRisk: (latest?.debtToEquity ?? 0) > 1.5 ? "elevated" : "moderate", valuationRisk: (latest?.pe ?? 0) > 40 ? "elevated" : "moderate", marketRisk: (oneYear?.price.volatilityAnnualizedPct ?? 0) > 40 ? "elevated" : "moderate", technicalRisk: (oneYear?.price.maxDrawdownPct ?? 0) < -30 ? "elevated" : "moderate", investmentRisk: "not_assessable", reason: "Risk categories are research signals, not personalized investment advice." };
}

export function normalizeScenarioProbabilities(values: number[]) {
  const clean = values.map((value) => Math.max(0, Number(value) || 0));
  const total = clean.reduce((sum, value) => sum + value, 0);
  return total ? clean.map((value) => value / total) : clean.map(() => 1 / clean.length);
}

export function probabilityWeightedReturn(scenarios: Array<{ probability: number; expectedReturnPct: number }>) {
  const probabilities = normalizeScenarioProbabilities(scenarios.map((scenario) => scenario.probability));
  return scenarios.reduce((total, scenario, index) => total + probabilities[index] * scenario.expectedReturnPct, 0);
}

function returns(rows: MarketObservation[]) { return rows.slice(1).map((row, index) => Math.log(row.close / rows[index].close)).filter(Number.isFinite); }
function change(rows: MarketObservation[], key: "close" | "niftyClose" | "sectorClose") {
  const values = rows.map((row) => safeNumber(row[key])).filter((value): value is number => value !== undefined && value > 0);
  return values.length > 1 ? (values.at(-1)! / values[0] - 1) * 100 : null;
}
function drawdown(rows: MarketObservation[]) {
  let peak = 0; let worst = 0;
  for (const row of rows) { peak = Math.max(peak, row.close); worst = Math.min(worst, (row.close / peak - 1) * 100); }
  return worst;
}
function rsi(rows: MarketObservation[]) {
  const changes = rows.slice(-15).slice(1).map((row, index) => row.close - rows.slice(-15)[index].close);
  if (changes.length < 14) return null;
  const gains = mean(changes.map((value) => Math.max(0, value))); const losses = mean(changes.map((value) => Math.max(0, -value)));
  return losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
}

const last = (values: number[]) => values.length ? values.at(-1)! : null;
const sma = (values: number[], period: number) => values.length >= period ? mean(values.slice(-period)) : null;
const emaValue = (values: number[], period: number) => values.length >= period ? ema(values.slice(-period), period) : null;

/** Deterministic indicators. Null means the provider supplied insufficient data. */
export function calculateTechnicalIndicators(observations: MarketObservation[]) {
  const rows = [...observations].filter((row) => row.close > 0 && !Number.isNaN(asDate(row.asOf))).sort((a, b) => asDate(a.asOf) - asDate(b.asOf));
  const closes = rows.map((row) => row.close); const volumes = rows.map((row) => safeNumber(row.volume));
  const ema12 = emaValue(closes, 12); const ema26 = emaValue(closes, 26); const macd = ema12 === null || ema26 === null ? null : ema12 - ema26;
  const macdSeries = closes.length >= 34 ? closes.slice(25).map((_, index) => {
    const sample = closes.slice(0, index + 26); return emaValue(sample, 12)! - emaValue(sample, 26)!;
  }) : [];
  const macdSignal = emaValue(macdSeries, 9);
  const window20 = closes.slice(-20); const average20 = sma(closes, 20); const deviation20 = window20.length === 20 ? std(window20) : null;
  const highLowRows = rows.filter((row) => safeNumber(row.high) !== undefined && safeNumber(row.low) !== undefined);
  const trueRanges = highLowRows.slice(1).map((row, index) => Math.max((row.high as number) - (row.low as number), Math.abs((row.high as number) - highLowRows[index].close), Math.abs((row.low as number) - highLowRows[index].close)));
  const recent14 = highLowRows.slice(-14); const highest14 = recent14.length === 14 ? Math.max(...recent14.map((row) => row.high as number)) : null; const lowest14 = recent14.length === 14 ? Math.min(...recent14.map((row) => row.low as number)) : null;
  let obv = 0;
  for (let index = 1; index < rows.length; index += 1) { const volume = volumes[index]; if (volume === undefined) continue; obv += rows[index].close > rows[index - 1].close ? volume : rows[index].close < rows[index - 1].close ? -volume : 0; }
  const latest = last(closes); const prior = closes.at(-15);
  return {
    observations: rows.length, sma20: sma(closes, 20), sma50: sma(closes, 50), sma100: sma(closes, 100), sma200: sma(closes, 200), ema9: emaValue(closes, 9), ema12, ema26,
    rsi14: rsi(rows), macd, macdSignal, macdHistogram: macd === null || macdSignal === null ? null : macd - macdSignal,
    bollinger: average20 === null || deviation20 === null ? null : { middle: average20, upper: average20 + 2 * deviation20, lower: average20 - 2 * deviation20 },
    atr14: trueRanges.length >= 14 ? mean(trueRanges.slice(-14)) : null,
    stochastic14: latest === null || highest14 === null || lowest14 === null || highest14 === lowest14 ? null : ((latest - lowest14) / (highest14 - lowest14)) * 100,
    obv: volumes.some((value) => value !== undefined) ? obv : null,
    momentum14: latest === null || prior === undefined ? null : latest - prior,
    rateOfChange14Pct: latest === null || prior === undefined || prior === 0 ? null : ((latest / prior) - 1) * 100,
  };
}

export function aggregateTimeframes(observations: MarketObservation[]) {
  const sorted = [...observations].filter((row) => row.close > 0 && !Number.isNaN(asDate(row.asOf))).sort((a, b) => asDate(a.asOf) - asDate(b.asOf));
  const latest = sorted.at(-1);
  return (Object.keys(DAYS) as Timeframe[]).map((timeframe) => {
    const rows = latest ? sorted.filter((row) => asDate(row.asOf) >= dateCutoff(latest.asOf, DAYS[timeframe])) : [];
    const closeChange = change(rows, "close"); const niftyChange = change(rows, "niftyClose"); const sectorChange = change(rows, "sectorClose");
    const volumes = rows.map((row) => safeNumber(row.volume)).filter((value): value is number => value !== undefined && value >= 0);
    const recentVolume = mean(volumes.slice(-Math.min(5, volumes.length))); const baselineVolume = mean(volumes.slice(0, Math.max(0, volumes.length - Math.min(5, volumes.length))));
    const closes = rows.map((row) => row.close); const dailyReturns = returns(rows); const indicators = calculateTechnicalIndicators(rows);
    return { timeframe, available: rows.length >= 2, observations: rows.length, startDate: rows[0]?.asOf || null, endDate: latest?.asOf || null,
      price: { close: latest?.close ?? null, changePct: closeChange, volatilityAnnualizedPct: dailyReturns.length > 1 ? std(dailyReturns) * Math.sqrt(252) * 100 : null, maxDrawdownPct: rows.length ? drawdown(rows) : null },
      volume: { average: volumes.length ? mean(volumes) : null, recentAverage: volumes.length ? recentVolume : null, abnormal: baselineVolume > 0 ? recentVolume / baselineVolume >= 1.8 : null },
      relativeStrength: { nifty50Pct: niftyChange === null || closeChange === null ? null : closeChange - niftyChange, sectorPct: sectorChange === null || closeChange === null ? null : closeChange - sectorChange },
      technical: { ...indicators, ma20: indicators.sma20, ma50: indicators.sma50, support: closes.length ? Math.min(...closes.slice(-20)) : null, resistance: closes.length ? Math.max(...closes.slice(-20)) : null, volumeConfirmed: baselineVolume > 0 ? recentVolume >= baselineVolume : null },
      interpretation: rows.length < 2 ? "Insufficient sourced observations for this timeframe." : `${closeChange! >= 0 ? "Price rose" : "Price fell"} ${Math.abs(closeChange!).toFixed(1)}%; ${niftyChange === null ? "benchmark comparison is unavailable" : `relative to Nifty it ${closeChange! - niftyChange >= 0 ? "outperformed" : "underperformed"} by ${Math.abs(closeChange! - niftyChange).toFixed(1)} percentage points`}.` };
  });
}

function latestFundamental(rows: FundamentalSnapshot[]) { return [...rows].sort((a, b) => asDate(a.asOf) - asDate(b.asOf)).at(-1); }
function sources(observations: MarketObservation[], fundamentals: FundamentalSnapshot[], research: ResearchItem[]) { return [...new Set([...observations, ...fundamentals, ...research].map((row) => row.sourceUrl).filter(Boolean))].slice(0, 30); }
function factor(id: string, rawValue: number | null, weight: number, explanation: string, source: string[], sampleSize: number): Factor {
  // A missing input is not neutral evidence. Keeping this null prevents API
  // consumers from accidentally charting it as a real zero-valued score.
  const normalizedScore = rawValue === null ? null : clamp(rawValue / 20, -1, 1);
  return { id, rawValue, normalizedScore, direction: classify(normalizedScore), weight, confidence: rawValue === null ? "low" : confidence(sampleSize), freshness: rawValue === null ? "missing" : "fresh", availability: rawValue === null ? "unavailable" : "available", source, explanation };
}

export function scoreFactors(observations: MarketObservation[], fundamentals: FundamentalSnapshot[], research: ResearchItem[]) {
  const latest = latestFundamental(fundamentals); const windows = aggregateTimeframes(observations); const oneYear = windows.find((window) => window.timeframe === "1Y"); const oneMonth = windows.find((window) => window.timeframe === "1M");
  const urls = sources(observations, fundamentals, research); const recentEvents = research.filter((item) => item.materiality === "high" && !item.conflicted).length;
  return [
    factor("fundamentals", latest?.roce ?? latest?.roe ?? null, .15, latest ? "Return metrics are derived from the latest sourced fundamental snapshot." : "No sourced fundamental snapshot is available.", urls, fundamentals.length),
    factor("earnings_momentum", latest?.netProfit && latest.revenue ? (latest.netProfit / latest.revenue) * 100 : null, .10, "Uses the latest reported profit margin when sourced results are available.", urls, fundamentals.length),
    factor("valuation", latest?.pe ? -Math.max(0, latest.pe - 25) / 2 : null, .10, "A high P/E is treated as valuation risk; peer and historical valuation data are required for a full score.", urls, fundamentals.length),
    factor("currency", null, .05, "Unavailable: company-specific foreign revenue, cost, debt and hedge data have not been sourced.", [], 0),
    factor("interest_rates", latest?.debtToEquity === undefined ? null : -latest.debtToEquity * 10, .05, "Leverage is used as a refinancing-rate sensitivity proxy.", urls, fundamentals.length),
    factor("inflation_input_costs", null, .05, "Unavailable: sourced input-cost exposure and pricing-power data are required.", [], 0),
    factor("sector_dynamics", oneMonth?.relativeStrength.sectorPct ?? null, .10, "Measures relative performance versus the supplied sector index.", urls, observations.length),
    factor("capital_flows", observations.at(-1)?.fiiNetFlow ?? null, .05, "Uses the latest sourced FII/FPI flow observation when available.", urls, observations.length),
    factor("global_geopolitical_risk", null, .05, "Unavailable: a documented company-specific global exposure map is required.", [], 0),
    factor("events", recentEvents ? recentEvents * 5 : null, .10, "Counts non-conflicted, high-materiality sourced events; direction requires analyst review.", urls, research.length),
    factor("sentiment", null, .05, "Unavailable: verified, licensed sentiment observations are required; source reliability is not a sentiment score.", [], 0),
    factor("technicals", oneYear?.price.changePct ?? null, .15, "Technical trend is a timing overlay and does not override fundamental or macro risk.", urls, observations.length),
  ];
}

export function generateScenarios(observations: MarketObservation[]) {
  const sorted = [...observations].sort((a, b) => asDate(a.asOf) - asDate(b.asOf)); const latest = sorted.at(-1);
  if (!latest || sorted.length < 30) return (Object.keys(HORIZON_DAYS) as Horizon[]).map((horizon) => ({ horizon, available: false, reason: "At least 30 sourced observations are required; no forecast is produced.", scenarios: [], probabilityWeightedReturnPct: null }));
  const daily = returns(sorted); const drift = clamp(mean(daily) * 252 * 100, -40, 40); const volatility = Math.max(1, std(daily) * Math.sqrt(252) * 100);
  return (Object.keys(HORIZON_DAYS) as Horizon[]).map((horizon) => {
    const scale = Math.sqrt(HORIZON_DAYS[horizon] / 252); const base = drift * HORIZON_DAYS[horizon] / 252; const probabilities = normalizeScenarioProbabilities([.15, .50, .25, .10]);
    const definitions = [["bull", base + 1.25 * volatility * scale], ["base", base], ["bear", base - 1.0 * volatility * scale], ["stress", base - 2.0 * volatility * scale]] as const;
    const scenarios = definitions.map(([name, expectedReturnPct]) => ({ name, probability: null as number | null, expectedReturnPct: Number(expectedReturnPct.toFixed(2)), expectedPriceRange: { low: Number((latest.close * (1 + (expectedReturnPct - volatility * scale) / 100)).toFixed(2)), high: Number((latest.close * (1 + (expectedReturnPct + volatility * scale) / 100)).toFixed(2)) }, primaryDrivers: ["Historical drift and volatility"], primaryRisks: ["Model uncertainty", "Market, macro and event risk"], assumptions: ["No unrecorded material event", "Historical volatility remains representative"], confidence: null, invalidationConditions: ["Material filing, earnings, policy or liquidity change", "Data becomes stale or conflicts"], dataSources: [...new Set(sorted.map((row) => row.sourceUrl))] }));
    return { horizon, available: true, calibrated: false, scenarios, probabilityWeightedReturnPct: null, limitation: "Illustrative scenarios only: probabilities, confidence, and weighted expected return are suppressed until walk-forward calibration is complete." };
  });
}

export function buildStockIntelligence(input: { symbol: string; exchange: string; observations: MarketObservation[]; fundamentals: FundamentalSnapshot[]; research: ResearchItem[]; modelVersion?: string }) {
  const observations = input.observations.filter((row) => row.symbol === input.symbol && row.exchange === input.exchange);
  const fundamentals = input.fundamentals.filter((row) => row.symbol === input.symbol && row.exchange === input.exchange);
  const research = input.research.filter((row) => row.symbol === input.symbol && row.exchange === input.exchange);
  const factors = scoreFactors(observations, fundamentals, research);
  const availableFactors = factors.filter((item) => item.normalizedScore !== null);
  const availableWeight = availableFactors.reduce((total, item) => total + item.weight, 0);
  const score = availableWeight ? availableFactors.reduce((total, item) => total + (item.normalizedScore as number) * (item.weight / availableWeight), 0) : null;
  const evidenceCoveragePct = Number((availableWeight * 100).toFixed(1));
  const riskAssessment = assessRisk({ observations, fundamentals, research, evidenceCoveragePct });
  return { symbol: input.symbol, exchange: input.exchange, generatedAt: new Date().toISOString(), modelVersion: input.modelVersion || "stock-intelligence-v1", disclaimer: "Not investment advice. Predictions are probabilistic and may be wrong.", dataConfidence: confidence(observations.length), riskLevel: riskAssessment.investmentRisk, riskAssessment, timeframeAnalysis: aggregateTimeframes(observations), factors, scenarios: generateScenarios(observations), research: research.map(({ title, publishedAt, sourceUrl, sourceClass, materiality, conflicted }) => ({ title, publishedAt, sourceUrl, sourceClass, materiality, conflicted: Boolean(conflicted) })), explainability: { evidenceCoveragePct, weightRedistributed: availableWeight > 0 && availableWeight < 1, whySelected: factors.filter((item) => item.normalizedScore !== null && item.normalizedScore > .1).slice(0, 3).map((item) => item.explanation), negativeFactors: factors.filter((item) => item.normalizedScore !== null && item.normalizedScore < -.1).slice(0, 3).map((item) => item.explanation), whatToMonitor: ["Results and exchange filings", "RBI policy, USD/INR, crude and FII/FPI flows", "Sector benchmark and liquidity"], limitations: ["No live market-data provider is connected.", ...(availableWeight && availableWeight < 1 ? ["Only available factor weights were normalized; unavailable evidence was not treated as neutral."] : []), ...(observations.length < 30 ? ["Historical observations are insufficient for a scenario forecast."] : []), ...(fundamentals.length ? [] : ["No sourced fundamentals are available."]), ...(research.length ? [] : ["No sourced filings or research items are available."]) ] }, sources: sources(observations, fundamentals, research) };
}

export function pointInTimeBacktest(observations: MarketObservation[], horizonDays: number) {
  const sorted = [...observations].sort((a, b) => asDate(a.asOf) - asDate(b.asOf)); const outcomes: Array<{ asOf: string; predictedDirection: number; realizedReturnPct: number }> = [];
  for (let index = 30; index + horizonDays < sorted.length; index++) { const history = sorted.slice(0, index + 1); const scenario = generateScenarios(history).find((item) => item.horizon === (horizonDays <= 5 ? "1W" : horizonDays <= 21 ? "1M" : horizonDays <= 63 ? "3M" : horizonDays <= 126 ? "6M" : "12M")); if (!scenario?.available) continue; const realized = (sorted[index + horizonDays].close / sorted[index].close - 1) * 100; outcomes.push({ asOf: sorted[index].asOf, predictedDirection: Number(scenario.probabilityWeightedReturnPct) || 0, realizedReturnPct: realized }); }
  const hits = outcomes.filter((row) => Math.sign(row.predictedDirection) === Math.sign(row.realizedReturnPct)).length;
  return { observations: outcomes.length, hitRate: outcomes.length ? hits / outcomes.length : null, note: "Uses only data available on or before each as-of date; transaction costs, benchmark and calibration metrics require additional point-in-time datasets." };
}

export type RankingMode = "momentum" | "quality" | "value" | "growth" | "balanced";
export type StockCandidate = { symbol: string; exchange: string; observations: MarketObservation[]; fundamentals: FundamentalSnapshot[]; research: ResearchItem[]; regulatoryRestricted?: boolean; liquidityScore?: number };
export type DataQuality = { eligible: boolean; reasons: string[]; latestAsOf: string | null; observationCount: number; fundamentalCount: number; conflictingSources: number; duplicateDates: number; stale: boolean };

/** Validates records before scoring. A stale or conflicting source is excluded by default. */
export function validateStockData(candidate: StockCandidate, now = new Date(), maximumAgeDays = 7): DataQuality {
  const observations = candidate.observations.filter((row) => row.symbol === candidate.symbol && row.exchange === candidate.exchange);
  const fundamentals = candidate.fundamentals.filter((row) => row.symbol === candidate.symbol && row.exchange === candidate.exchange);
  const research = candidate.research.filter((row) => row.symbol === candidate.symbol && row.exchange === candidate.exchange);
  const dates = observations.map((row) => row.asOf); const duplicateDates = dates.length - new Set(dates).size;
  const latestAsOf = [...dates].sort().at(-1) || null;
  const latestTime = latestAsOf ? asDate(latestAsOf) : NaN;
  const stale = !Number.isFinite(latestTime) || now.getTime() - latestTime > maximumAgeDays * 86_400_000;
  const conflictingSources = research.filter((item) => item.conflicted || item.sourceClass === "rumor" || item.sourceClass === "unverified_claim").length;
  const reasons: string[] = [];
  if (candidate.regulatoryRestricted) reasons.push("Regulatory restriction flag is set.");
  if (observations.length < 30) reasons.push("At least 30 sourced price observations are required.");
  if (!fundamentals.length) reasons.push("At least one sourced fundamental snapshot is required.");
  if ((candidate.liquidityScore ?? 1) < .4) reasons.push("Liquidity score is below the configured minimum.");
  if (duplicateDates) reasons.push("Duplicate observation dates require reconciliation.");
  if (stale) reasons.push("Latest market observation is stale.");
  if (conflictingSources) reasons.push("Conflicting, rumor, or unverified research requires review.");
  return { eligible: reasons.length === 0, reasons, latestAsOf, observationCount: observations.length, fundamentalCount: fundamentals.length, conflictingSources, duplicateDates, stale };
}

const bounded = (value: number | null | undefined, divisor = 20) => value === null || value === undefined ? 0 : clamp(value / divisor, -1, 1);
function growthFromSnapshots(rows: FundamentalSnapshot[], key: "revenue" | "netProfit" | "eps") {
  const values = [...rows].sort((a, b) => asDate(a.asOf) - asDate(b.asOf)).map((row) => safeNumber(row[key])).filter((value): value is number => value !== undefined && value !== 0);
  return values.length > 1 ? (values.at(-1)! / values[0] - 1) * 100 : null;
}

/**
 * Ranks a supplied, point-in-time India equity universe. It does not claim to
 * know the full NSE/BSE universe: the ingestion layer supplies candidates.
 */
export function rankIndiaStocks(candidates: StockCandidate[], mode: RankingMode = "balanced", options: { limit?: number; now?: Date; includeFlagged?: boolean; minimumLiquidityScore?: number } = {}) {
  const now = options.now || new Date(); const limit = options.limit || 5; const minimumLiquidityScore = options.minimumLiquidityScore ?? .4;
  const scored = candidates.map((candidate) => {
    const quality = validateStockData({ ...candidate, liquidityScore: candidate.liquidityScore ?? 1 }, now);
    const windows = aggregateTimeframes(candidate.observations); const oneYear = windows.find((item) => item.timeframe === "1Y"); const sixMonths = windows.find((item) => item.timeframe === "6M"); const oneMonth = windows.find((item) => item.timeframe === "1M"); const oneWeek = windows.find((item) => item.timeframe === "1W");
    const latest = latestFundamental(candidate.fundamentals); const momentum = mean([oneYear?.price.changePct, sixMonths?.price.changePct, oneMonth?.price.changePct, oneWeek?.price.changePct].filter((value): value is number => value !== null && value !== undefined));
    const qualityScore = mean([bounded(latest?.roe ?? latest?.roce), bounded(latest?.roce), bounded(latest?.ebitdaMargin), bounded(latest?.freeCashFlow, 1_000_000), latest?.debtToEquity === undefined ? 0 : -bounded(latest.debtToEquity * 10)]);
    const valueScore = mean([latest?.pe === undefined ? 0 : bounded(25 - latest.pe), latest?.pb === undefined ? 0 : bounded(4 - latest.pb), latest?.evEbitda === undefined ? 0 : bounded(15 - latest.evEbitda), bounded(latest?.dividendYield)]);
    const growthScore = mean([bounded(growthFromSnapshots(candidate.fundamentals, "revenue")), bounded(growthFromSnapshots(candidate.fundamentals, "netProfit")), bounded(growthFromSnapshots(candidate.fundamentals, "eps"))]);
    const riskPenalty = Math.max(0, (oneYear?.price.volatilityAnnualizedPct || 0) / 100) + Math.max(0, -(oneYear?.price.maxDrawdownPct || 0) / 100) + quality.conflictingSources * .25;
    const normalizedMomentum = bounded(momentum); const liquidity = clamp(candidate.liquidityScore ?? 1, 0, 1);
    const components = { momentum: normalizedMomentum, quality: qualityScore, value: valueScore, growth: growthScore, liquidity, risk: -riskPenalty };
    const score = mode === "momentum" ? normalizedMomentum : mode === "quality" ? qualityScore : mode === "value" ? valueScore : mode === "growth" ? growthScore : .25 * normalizedMomentum + .25 * qualityScore + .20 * valueScore + .20 * growthScore + .10 * liquidity - .15 * riskPenalty;
    const eligible = quality.eligible && liquidity >= minimumLiquidityScore;
    return { symbol: candidate.symbol, exchange: candidate.exchange, score: Number((score * 100).toFixed(2)), eligible, quality, components, whySelected: ["momentum", "quality", "value", "growth"].sort((a, b) => Math.abs(components[b as keyof typeof components]) - Math.abs(components[a as keyof typeof components])).slice(0, 3) };
  });
  const included = scored.filter((item) => item.eligible || options.includeFlagged).sort((a, b) => b.score - a.score).slice(0, limit);
  return { mode, asOf: now.toISOString(), selected: included, excluded: scored.filter((item) => !item.eligible), disclaimer: "Not investment advice. Rankings are deterministic, data-dependent and may be wrong." };
}
