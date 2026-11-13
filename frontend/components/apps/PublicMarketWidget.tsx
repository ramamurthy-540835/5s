"use client";

import { useEffect, useRef } from "react";

type PublicMarketWidgetProps = {
  exchange: string;
  symbol: string;
  companyName?: string | null;
};

const supportedExchange = (exchange: string) => exchange === "NSE" || exchange === "BSE";

export default function PublicMarketWidget({ exchange, symbol, companyName }: PublicMarketWidgetProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const marketSymbol = `${exchange}:${symbol}`;

  useEffect(() => {
    const target = container.current;
    if (!target || !supportedExchange(exchange) || !symbol) return;
    target.replaceChildren();
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.async = true;
    script.type = "text/javascript";
    script.text = JSON.stringify({
      symbols: [[companyName || marketSymbol, `${marketSymbol}|1D`]],
      chartOnly: false,
      width: "100%",
      height: 420,
      locale: "en",
      colorTheme: "light",
      autosize: true,
      showVolume: true,
      showMA: true,
      hideDateRanges: false,
      hideMarketStatus: false,
      scalePosition: "right",
      scaleMode: "Normal",
      fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
      fontSize: "10",
      noTimeScale: false,
      valuesTracking: "1",
      changeMode: "price-and-percent",
      chartType: "area",
      lineWidth: 2,
      lineType: 0,
      dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
    });
    target.appendChild(script);
    return () => { target.replaceChildren(); };
  }, [exchange, marketSymbol, symbol]);

  if (!supportedExchange(exchange) || !symbol) return <p className="mt-3 text-sm text-[#525252]">A public chart is unavailable for this instrument.</p>;

  return <section className="rounded border bg-white p-4" aria-label={`Public market chart for ${marketSymbol}`}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">Public market chart</h3><p className="text-sm text-[#525252]">{companyName || symbol} · {marketSymbol}</p></div><span className="rounded bg-[#e8f1fb] px-2 py-1 text-xs">Demo display</span></div>
    <p className="mt-2 text-xs text-[#525252]">Hosted by TradingView. Data availability and delay are determined by TradingView and the exchange. PRISM does not store, redistribute, rank, or forecast from this displayed data.</p>
    <div className="tradingview-widget-container mt-3 min-h-[420px]" ref={container} />
    <p className="mt-2 text-xs text-[#525252]"><a className="text-blue-700 underline" href={`https://www.tradingview.com/symbols/${encodeURIComponent(marketSymbol)}/`} target="_blank" rel="noreferrer">View {marketSymbol} on TradingView</a></p>
  </section>;
}
