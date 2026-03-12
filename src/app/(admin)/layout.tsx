import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { MobileAdminNav } from "@/components/admin/mobile-admin-nav";
import { AdminAuthReady } from "@/components/admin/admin-auth-ready";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthReady>
      <div className="flex min-h-screen min-h-[100dvh] bg-background">
        <div className="hidden md:block">
          <AdminSidebar />
        </div>
        <MobileAdminNav />
        <main className="flex-1 flex flex-col overflow-auto pt-14 md:pt-0 w-full max-w-full">
          {children}
        </main>
      </div>
    </AdminAuthReady>
  );
}