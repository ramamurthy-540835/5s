"use client";

import { useEffect, useRef, useState } from "react";
import PublicMarketWidget from "@/components/apps/PublicMarketWidget";

type Instrument = { exchange: string; symbol: string; instrumentId: string; companyName?: string | null; aliases?: string[]; isin?: string | null; tradingStatus?: string; sourceUrl?: string };
type Report = any;
type Ranking = { selected?: Array<any>; excluded?: Array<any>; limitation?: string; providerStatus?: string };

const frames = ["3Y", "1Y", "6M", "3M", "1M", "1W", "1D"];
const horizons = ["1W", "1M", "3M", "6M", "12M"];
const rankingModes = [
  ["balanced", "Balanced"], ["top-gainers", "Top Gainers"], ["most-active", "Most Active"], ["market-leaders", "Market Leaders"],
  ["momentum", "Momentum"], ["quality", "Quality"], ["value", "Value"], ["growth", "Growth"],
] as const;
const pct = (value: unknown) => value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`;
const inr = (value: unknown) => value === null || value === undefined ? "—" : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const displayName = (item: Instrument) => item.companyName || item.symbol;

export default function StockIntelligencePanel() {
  const [symbols, setSymbols] = useState<Instrument[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [frame, setFrame] = useState("1Y");
  const [horizon, setHorizon] = useState("3M");
  const [message, setMessage] = useState("");
  const [rankingMode, setRankingMode] = useState("balanced");
  const [nseRanking, setNseRanking] = useState<Ranking | null>(null);
  const [bseRanking, setBseRanking] = useState<Ranking | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Instrument[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeMatch, setActiveMatch] = useState(-1);
  const searchController = useRef<AbortController | null>(null);

  const load = async (instrument?: string) => {
    setMessage("");
    const response = await fetch(`/api/prism/apps/stock-exchange?view=intelligence${instrument ? `&instrument=${encodeURIComponent(instrument)}` : ""}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error || "Could not load Stock Intelligence"); return; }
    setSymbols(Array.isArray(body.symbols) ? body.symbols : []);
    setReport(body.report || null);
  };

  const loadRankings = async (mode = rankingMode) => {
    const [nse, bse] = await Promise.all(["NSE", "BSE"].map(async (exchange) => {
      const response = await fetch(`/api/prism/apps/stock-exchange?view=top5&exchange=${exchange}&mode=${encodeURIComponent(mode)}`, { cache: "no-store" });
      return response.ok ? await response.json() : { limitation: "Ranking data could not be loaded." };
    }));
    setNseRanking(nse); setBseRanking(bse);
  };

  useEffect(() => { void load(); void loadRankings(); }, []);
  useEffect(() => {
    searchController.current?.abort();
    if (query.trim().length < 3) { setMatches([]); setSearching(false); setActiveMatch(-1); return; }
    const controller = new AbortController(); searchController.current = controller;
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/prism/apps/stock-exchange?view=search&q=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Search is unavailable");
        setMatches(Array.isArray(body.instruments) ? body.instruments : []); setNextCursor(typeof body.nextCursor === "string" ? body.nextCursor : null); setActiveMatch(-1);
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") setMessage((cause as Error).message);
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 220);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query]);

  const choose = (item: Instrument) => {
    setQuery(""); setMatches([]); setNextCursor(null); setActiveMatch(-1);
    setSelectedInstrument(item);
    window.history.replaceState(null, "", `/admin/prism/stock-intelligence?instrument=${encodeURIComponent(item.instrumentId)}`);
    void load(item.instrumentId);
  };
  const openRanked = (item: any) => choose({ exchange: item.exchange, symbol: item.symbol, instrumentId: `${item.exchange}:${item.symbol}`, companyName: item.companyName });
  const timeframe = report?.timeframeAnalysis?.find((item: any) => item.timeframe === frame);
  const scenario = report?.scenarios?.find((item: any) => item.horizon === horizon);

  const rankingPanel = (exchange: "NSE" | "BSE", ranking: Ranking | null) => <article className="rounded border bg-white p-4" aria-label={`Top 5 ${exchange} stocks`}>
    <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Top 5 {exchange} Stocks</h3><span className="rounded bg-[#e8f1fb] px-2 py-1 text-xs">Workspace sourced</span></div>
    {ranking?.selected?.length ? <ol className="mt-3 space-y-2">{ranking.selected.map((item: any, index: number) => <li key={`${item.exchange}:${item.symbol}`}><button type="button" onClick={() => openRanked(item)} className="w-full rounded bg-[#f4f7fb] p-2 text-left hover:bg-[#e8f1fb]"><strong>{index + 1}. {item.companyName || item.symbol}</strong> <span className="text-xs">{item.exchange}:{item.symbol}</span><p className="mt-1 text-xs text-[#525252]">{item.whySelected?.join(" ") || "Sourced ranking result."}</p></button></li>)}</ol> : <p className="mt-3 text-sm text-[#525252]">{ranking?.limitation || "No eligible verified instruments are available for this exchange."}</p>}
    <p className="mt-3 text-xs text-[#525252]">Ranks are research outputs, not buy recommendations. Prices, timestamps and data freshness are shown only when a licensed provider is configured.</p>
  </article>;

  return <section className="ibm-panel space-y-5 p-5">
    <div className="text-center"><h2 className="text-lg font-semibold">Stock Intelligence</h2><p className="mt-1 text-sm text-[#525252]">For research and education only. Not investment advice. Forecasts are uncertain; losses are possible. No broker execution is connected.</p><p className="mt-2 text-xs text-[#525252]">India reference catalogue is incomplete and identifier-only. It is not live market data; prices, charts, rankings and forecasts remain unavailable without an authorized provider.</p></div>
    <div className="mx-auto max-w-3xl"><label className="sr-only" htmlFor="stock-search">Search NSE & BSE stocks by company name or ticker</label><div className="relative"><input id="stock-search" role="combobox" aria-autocomplete="list" aria-expanded={matches.length > 0} aria-controls="stock-search-results" aria-activedescendant={activeMatch >= 0 ? `stock-search-option-${activeMatch}` : undefined} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActiveMatch((value) => Math.min(value + 1, matches.length - 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveMatch((value) => Math.max(value - 1, 0)); } else if (event.key === "Enter" && activeMatch >= 0 && matches[activeMatch]) { event.preventDefault(); choose(matches[activeMatch]); } else if (event.key === "Escape") { setMatches([]); setActiveMatch(-1); } }} placeholder="Search NSE & BSE stocks by company name or ticker" className="w-full rounded border border-[#0f62fe] px-4 py-3 pr-20 shadow-sm" />{query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-3 text-sm text-blue-700">Clear</button>}{matches.length > 0 && <ul id="stock-search-results" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded border bg-white shadow-lg">{matches.map((item, index) => <li id={`stock-search-option-${index}`} key={item.instrumentId} role="option" aria-selected={activeMatch === index}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)} className={`w-full px-4 py-3 text-left ${activeMatch === index ? "bg-[#e8f1fb]" : "hover:bg-[#f4f7fb]"}`}><strong>{displayName(item)}</strong> <span className="ml-2 text-sm">{item.symbol}</span><span className="ml-2 rounded bg-[#e8f1fb] px-1.5 py-0.5 text-xs">{item.exchange}</span>{item.isin && <span className="ml-2 text-xs text-[#525252]">ISIN {item.isin}</span>}<span className="ml-2 text-xs text-[#525252]">{item.tradingStatus || "unknown"}</span></button></li>)}</ul>}</div><p className="mt-2 text-center text-xs text-[#525252]">{query.length > 0 && query.length < 3 ? "Type at least 3 characters to search." : searching ? "Searching sourced workspace instruments…" : "India reference identifiers and sourced workspace instruments are searchable. The catalogue is incomplete and does not contain live market data."}</p></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Exchange rankings</h3><label className="text-sm">Mode <select aria-label="Stock ranking mode" className="ml-2 rounded border p-2" value={rankingMode} onChange={(event) => { setRankingMode(event.target.value); void loadRankings(event.target.value); }}>{rankingModes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="grid gap-4 lg:grid-cols-2">{rankingPanel("NSE", nseRanking)}{rankingPanel("BSE", bseRanking)}</div>
    {message && <p role="status" className="text-sm text-red-700">{message}</p>}
    {selectedInstrument && <PublicMarketWidget exchange={selectedInstrument.exchange} symbol={selectedInstrument.symbol} companyName={selectedInstrument.companyName} />}
    {!report ? <p className="rounded border bg-white p-4 text-sm text-[#525252]">Search the India reference catalogue to begin. The demo chart is a third-party display only; no quote, ranking, fundamental, news, or forecast is fabricated when a provider or sourced observations are unavailable.</p> : <>
      <div className="rounded border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{report.symbol} · {report.exchange}</h3><p className="text-sm text-[#525252]">Last sourced close: {inr(report.timeframeAnalysis?.[0]?.price?.close)} · Data confidence: {report.dataConfidence} · Risk: {report.riskLevel}</p></div><button type="button" className="ibm-btn-secondary px-3 py-2" onClick={() => { setReport(null); setSelectedInstrument(null); window.history.replaceState(null, "", "/admin/prism/stock-intelligence"); }}>Back to search</button></div></div>
      <div className="flex flex-wrap gap-2" aria-label="Historical timeframe">{frames.map((item) => <button key={item} type="button" className={frame === item ? "ibm-btn-primary px-3 py-1" : "ibm-btn-secondary px-3 py-1"} onClick={() => setFrame(item)}>{item === "1D" ? "Today" : item}</button>)}</div>
      <div className="rounded border bg-white p-4 text-sm"><h3 className="font-semibold">{frame === "1D" ? "Today" : frame} historical analysis</h3>{timeframe?.available ? <><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><p>Price change: <strong>{pct(timeframe.price.changePct)}</strong></p><p>Volatility: <strong>{pct(timeframe.price.volatilityAnnualizedPct)}</strong></p><p>Max drawdown: <strong>{pct(timeframe.price.maxDrawdownPct)}</strong></p><p>Nifty relative strength: <strong>{pct(timeframe.relativeStrength.nifty50Pct)}</strong></p><p>Sector relative strength: <strong>{pct(timeframe.relativeStrength.sectorPct)}</strong></p><p>Abnormal volume: <strong>{timeframe.volume.abnormal === null ? "—" : timeframe.volume.abnormal ? "Detected" : "No"}</strong></p><p>RSI (14): <strong>{timeframe.technical.rsi14?.toFixed?.(1) ?? "—"}</strong></p><p>Support / resistance: <strong>{timeframe.technical.support?.toFixed?.(2) ?? "—"} / {timeframe.technical.resistance?.toFixed?.(2) ?? "—"}</strong></p></div><p className="mt-3 text-[#525252]">{timeframe.interpretation}</p></> : <p className="mt-2 text-[#525252]">{timeframe?.interpretation || "Insufficient sourced observations for this timeframe."}</p>}<p className="mt-3 text-xs text-[#525252]">Chart/OHLC export requires an authorized provider and appropriate license. This view does not fill market holidays or invent intraday bars.</p></div>
      <div className="flex flex-wrap gap-2" aria-label="Forecast horizon">{horizons.map((item) => <button key={item} type="button" className={horizon === item ? "ibm-btn-primary px-3 py-1" : "ibm-btn-secondary px-3 py-1"} onClick={() => setHorizon(item)}>{item}</button>)}</div>
      <div className="rounded border bg-white p-4 text-sm"><h3 className="font-semibold">{horizon} future outlook</h3>{scenario?.available ? <><p className="mt-2 rounded border-l-4 border-amber-500 bg-amber-50 p-2 text-xs">{scenario.limitation || "Illustrative scenarios only; probabilities and confidence are unavailable."}</p><div className="mt-3 grid gap-3 lg:grid-cols-4">{scenario.scenarios.map((item: any) => <div key={item.name} className="rounded bg-[#f4f7fb] p-3"><strong className="capitalize">{item.name}</strong><p>Probability: unavailable pending calibration</p><p>Expected return: {pct(item.expectedReturnPct)}</p><p>Range: {inr(item.expectedPriceRange.low)}–{inr(item.expectedPriceRange.high)}</p><p className="mt-1 text-xs text-[#525252]">{item.invalidationConditions?.[0]}</p></div>)}</div></> : <p className="mt-2 text-[#525252]">{scenario?.reason || "Forecast suppressed: insufficient sourced history."}</p>}</div>
      <div className="rounded border bg-white p-4 text-sm"><h3 className="font-semibold">Evidence & drivers</h3><div className="mt-2 grid gap-2 md:grid-cols-2">{report.factors?.map((item: any) => <div className="rounded bg-[#f4f7fb] p-2" key={item.id}><strong>{String(item.id).replaceAll("_", " ")}</strong><p>Score: {Number(item.normalizedScore).toFixed(2)} · Confidence: {item.confidence} · Freshness: {item.freshness}</p><p className="text-xs text-[#525252]">{item.explanation}</p></div>)}</div></div>
      <div className="rounded border bg-white p-4 text-sm"><h3 className="font-semibold">Sources, risks & limitations</h3><p className="mt-2">{report.explainability?.limitations?.join(" ")}</p>{report.research?.length ? <ul className="mt-3 list-disc space-y-1 pl-5">{report.research.map((item: any) => <li key={`${item.publishedAt}:${item.sourceUrl}`}><a className="text-blue-700 underline" href={item.sourceUrl} target="_blank" rel="noreferrer">{item.title}</a> · {item.sourceClass} · {item.materiality}{item.conflicted ? " · conflicting" : ""}</li>)}</ul> : <p className="mt-2 text-[#525252]">No sourced filings or research items are available.</p>}</div>
    </>}
  </section>;
}
