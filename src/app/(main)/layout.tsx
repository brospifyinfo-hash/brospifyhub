"use client";

import { Sidebar } from "@/components/sidebar/sidebar";
import { MobileNav } from "@/components/sidebar/mobile-nav";
import { AuthReady } from "@/components/auth-ready";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthReady>
      <div className="flex min-h-screen min-h-[100dvh] bg-background">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <MobileNav />
        <main className="flex-1 md:ml-72 pt-14 md:pt-0 overflow-auto w-full max-w-full">
          {children}
        </main>
      </div>
    </AuthReady>
  );
}
