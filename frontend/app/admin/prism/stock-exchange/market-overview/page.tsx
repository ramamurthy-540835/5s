import MarketOverviewDashboard from "@/components/apps/MarketOverviewDashboard";
import AppSidebar from "@/components/workbench/AppSidebar";
import WorkbenchHeader from "@/components/workbench/WorkbenchHeader";

export default function MarketOverviewPage() {
  return <div className="min-h-screen bg-white text-[#161616]"><WorkbenchHeader /><div className="flex"><AppSidebar /><main className="min-w-0 flex-1 bg-[#f8faff] p-6"><MarketOverviewDashboard /></main></div></div>;
}
