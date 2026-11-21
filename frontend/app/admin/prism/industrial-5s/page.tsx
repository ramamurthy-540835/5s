import Industrial5SWorkspace from "@/components/apps/Industrial5SWorkspace";
import AppSidebar from "@/components/workbench/AppSidebar";
import WorkbenchHeader from "@/components/workbench/WorkbenchHeader";

export default function Industrial5SPage() {
  return <div className="min-h-screen bg-white text-[#161616]"><WorkbenchHeader /><div className="flex"><AppSidebar /><main className="min-w-0 flex-1 bg-[#f8faff] p-4 md:p-6"><Industrial5SWorkspace /></main></div></div>;
}
