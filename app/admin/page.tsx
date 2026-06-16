import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();

  // If no admin session, redirect to login page
  if (!session) {
    console.log("[admin] Unauthorized admin access, redirecting to login");
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Brand Top Header */}
      <header className="border-b border-zinc-900 bg-zinc-950 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-[#3886c8] to-[#3886c8] shadow-md shadow-[#3886c8]/10">
              <span className="text-sm font-black text-white">J</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Jonathon Admin
            </span>
          </div>
          <nav className="flex items-center gap-2 text-xs font-semibold">
            <span className="rounded-lg border border-[#3886c8]/40 bg-[#0a1a2a]/30 px-3 py-1.5 text-[#5a9ce8]">
              Dashboard
            </span>
            <a
              href="/admin/frame"
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Frame
            </a>
          </nav>
        </div>
      </header>

      {/* Main Admin UI */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <AdminDashboard />
      </main>
    </div>
  );
}
