import Industrial5STemplateAdmin from "@/components/apps/Industrial5STemplateAdmin";
import AppSidebar from "@/components/workbench/AppSidebar";
import WorkbenchHeader from "@/components/workbench/WorkbenchHeader";
export default function Industrial5STemplatesPage() { return <div className="min-h-screen bg-white text-[#161616]"><WorkbenchHeader/><div className="flex"><AppSidebar/><main className="min-w-0 flex-1 bg-[#f8faff] p-4 md:p-6"><Industrial5STemplateAdmin/></main></div></div>; }
