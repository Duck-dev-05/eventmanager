import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { MobileNav, Sidebar } from "@/components/sidebar";
import { SidebarAccount } from "@/components/sidebar-account";
import { SidebarNextEvent } from "@/components/sidebar-next-event";
import { Topbar } from "@/components/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden"
      >
        <div className="absolute -top-44 left-[16%] h-[440px] w-[440px] rounded-full bg-[#f7dcc5]/45 blur-[120px]" />
        <div className="absolute -bottom-40 right-[-8%] h-[400px] w-[400px] rounded-full bg-[#cfdfe4]/50 blur-[130px]" />
      </div>

      <AppShell
        sidebar={
          <Sidebar
            next={
              <Suspense
                fallback={
                  <div className="h-[104px] rounded-2xl border border-line bg-white/60" />
                }
              >
                <SidebarNextEvent />
              </Suspense>
            }
            account={
              <Suspense
                fallback={
                  <div className="h-[60px] rounded-2xl border border-line bg-sunken/60" />
                }
              >
                <SidebarAccount />
              </Suspense>
            }
          />
        }
      >
        <MobileNav />
        <Topbar />
        <main className="animate-rise-in mx-auto w-full max-w-[1560px] px-4 py-5 pb-14 sm:px-6 lg:px-8 lg:py-7 print:max-w-none print:p-0">
          {children}
        </main>
      </AppShell>
    </div>
  );
}
