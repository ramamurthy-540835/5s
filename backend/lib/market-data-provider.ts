/**
 * Provider-neutral boundary for licensed Indian market data.  This module does
 * not scrape exchanges and does not contain provider URLs or credentials.
 * A deployment supplies an approved adapter and credentials only through the
 * runtime environment or Secret Manager.
 */
export type Exchange = "NSE" | "BSE";
export type DataClassification = "live" | "delayed" | "EOD" | "unavailable";
export type ProviderStatus = { configured: boolean; provider: string | null; reason: string | null; classification: DataClassification };
export type SourceMeta = { sourceUrl: string; observedAt: string; fetchedAt: string; classification: DataClassification; provider: string };
export type InstrumentMasterRecord = { instrumentId: string; exchange: Exchange; symbol: string; companyName: string; aliases: string[]; isin?: string; tradingStatus: "active" | "suspended" | "delisted"; syncedAt: string };
export type OhlcvBar = SourceMeta & { open: number; high: number; low: number; close: number; volume?: number; adjusted: boolean };
export type CorporateAction = SourceMeta & { kind: "split" | "bonus" | "dividend" | "rights" | "buyback" | "other"; effectiveDate: string; ratio?: string };
export type ProviderPage<T> = { items: T[]; nextCursor: string | null };
export type ProviderCapability = "instrument_master" | "quotes" | "eod_history" | "intraday" | "corporate_actions" | "fundamentals" | "indices" | "news" | "macro";
export type ProviderHealth = { provider: string; healthy: boolean; state: "closed" | "open"; capabilities: ProviderCapability[]; checkedAt: string; reason?: string };

export class ProviderUnavailableError extends Error { constructor(message = "No approved market-data provider is available for this request.") { super(message); this.name = "ProviderUnavailableError"; } }

export interface IndiaMarketDataProvider {
  readonly name: string;
  readonly classification: Exclude<DataClassification, "unavailable">;
  readonly capabilities: ProviderCapability[];
  searchInstruments(input: { query: string; exchange?: Exchange; cursor?: string; limit: number }): Promise<ProviderPage<InstrumentMasterRecord>>;
  history(input: { instrumentId: string; range: "3y" | "1y" | "6m" | "3m" | "1m" | "1w" | "1d"; intraday?: boolean }): Promise<OhlcvBar[]>;
  corporateActions(input: { instrumentId: string }): Promise<CorporateAction[]>;
  fundamentals(input: { instrumentId: string }): Promise<unknown[]>;
  indices(input: { exchange: Exchange; sector?: string }): Promise<unknown[]>;
  announcements(input: { instrumentId: string; cursor?: string }): Promise<ProviderPage<unknown>>;
}

/** Registry deliberately starts empty. Deployments register only licensed adapters. */
export class ProviderRegistry {
  private providers = new Map<string, IndiaMarketDataProvider>();
  private failures = new Map<string, { count: number; openedAt?: number }>();
  register(provider: IndiaMarketDataProvider) { this.providers.set(provider.name, provider); }
  get(name?: string) {
    const provider = name ? this.providers.get(name) : this.providers.values().next().value as IndiaMarketDataProvider | undefined;
    if (!provider) throw new ProviderUnavailableError();
    const state = this.failures.get(provider.name);
    if (state?.openedAt && Date.now() - state.openedAt < 30_000) throw new ProviderUnavailableError("Market-data provider circuit breaker is open; retry later.");
    return provider;
  }
  supports(capability: ProviderCapability, name?: string) { try { return this.get(name).capabilities.includes(capability); } catch { return false; } }
  recordSuccess(name: string) { this.failures.delete(name); }
  recordFailure(name: string) { const current = this.failures.get(name) || { count: 0 }; current.count += 1; if (current.count >= 3) current.openedAt = Date.now(); this.failures.set(name, current); }
  health(): ProviderHealth[] { return [...this.providers.values()].map((provider) => { const state = this.failures.get(provider.name); const open = Boolean(state?.openedAt && Date.now() - state.openedAt < 30_000); return { provider: provider.name, healthy: !open, state: open ? "open" : "closed", capabilities: provider.capabilities, checkedAt: new Date().toISOString(), reason: open ? "Circuit breaker open after repeated provider failures." : undefined }; }); }
}
export const marketDataProviders = new ProviderRegistry();

type CacheEntry<T> = { value: T; expiresAt: number };
const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function withProviderCache<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await load(); memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs }); return value;
}

export async function withRetry<T>(load: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await load(); }
    catch (error) { lastError = error; if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt)); }
  }
  throw lastError instanceof Error ? lastError : new Error("Market-data provider request failed");
}

export function marketDataProviderStatus(): ProviderStatus {
  const provider = process.env.MARKET_DATA_PROVIDER?.trim() || null;
  const credentialPresent = Boolean(process.env.MARKET_DATA_API_KEY || process.env.MARKET_DATA_BASE_URL);
  if (!provider || !credentialPresent) return { configured: false, provider: null, classification: "unavailable", reason: "No approved licensed market-data provider is configured." };
  return { configured: false, provider, classification: "unavailable", reason: "Provider configuration is present but no approved provider adapter has been registered." };
}
