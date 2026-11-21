import { Suspense } from "react";
import StockScreenerWorkspace from "@/components/apps/StockScreenerWorkspace";

function ScreenerLoadingFallback() {
  return <main className="min-h-screen bg-[#f8faff] p-4 text-[#161616] sm:p-6" aria-busy="true" aria-label="Loading Stock Screener"><div className="mx-auto max-w-[1600px] space-y-5"><section className="animate-pulse rounded border border-[#c6d4e8] bg-white p-5 shadow-sm"><div className="h-4 w-32 rounded bg-[#d9e2f0]" /><div className="mt-3 h-8 w-64 rounded bg-[#d9e2f0]" /><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-10 rounded bg-[#edf4ff]" />)}</div></section><section className="animate-pulse rounded border border-[#c6d4e8] bg-white p-5 shadow-sm"><div className="h-5 w-48 rounded bg-[#d9e2f0]" /><div className="mt-4 h-52 rounded bg-[#edf4ff]" /></section></div></main>;
}

export default function StockScreenerPage() {
  return <Suspense fallback={<ScreenerLoadingFallback />}><StockScreenerWorkspace /></Suspense>;
}
