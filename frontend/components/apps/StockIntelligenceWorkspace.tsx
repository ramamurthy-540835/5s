"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StockIntelligencePanel from "@/components/apps/StockIntelligencePanel";
import AppSidebar from "@/components/workbench/AppSidebar";
import WorkbenchHeader from "@/components/workbench/WorkbenchHeader";

export default function StockIntelligenceWorkspace() {
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    void fetch("/api/prism/auth", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => setSignedIn(Boolean(result.user)))
      .catch(() => setSignedIn(false));
  }, []);

  return <div className="min-h-screen bg-white text-[#161616]"><WorkbenchHeader /><div className="flex"><AppSidebar /><main className="min-w-0 flex-1 space-y-5 bg-[#f8faff] p-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Stock Intelligence</h1><p className="mt-2 text-sm text-[#525252]">Analyze source-attributed Indian-equity observations across timeframes, factors and scenario analysis.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/prism/stock-exchange/market-overview" className="rounded border border-[#0f62fe] px-3 py-2 text-sm font-medium text-[#0043ce] hover:bg-[#edf4ff]">Market Dashboard</Link><Link href="/admin/prism/stock-exchange/screener" className="rounded border border-[#0f62fe] px-3 py-2 text-sm font-medium text-[#0043ce] hover:bg-[#edf4ff]">Open Stock Screener</Link></div></header>
    <div className="ibm-panel max-w-5xl border-l-4 border-amber-500 p-4 text-sm">Not investment advice. Predictions are uncertain and may be wrong. No broker, exchange feed, or real-money execution is connected.</div>
    {!signedIn ? <div className="ibm-panel p-5">Sign in to use Stock Intelligence. <Link href="/login" className="text-blue-700 underline">Open sign in</Link></div> : <StockIntelligencePanel />}
  </main></div></div>;
}
