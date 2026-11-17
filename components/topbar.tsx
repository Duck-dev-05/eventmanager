import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/session-cookie";
import { AccountMenu } from "./account-menu";
import { Breadcrumbs } from "./breadcrumbs";
import { PlusIcon } from "./icons";
import { NotificationBell } from "./notification-bell";
import { SidebarToggle } from "./sidebar-toggle";
import { TopbarSearch } from "./topbar-search";

async function AccountArea() {
  await connection();
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <AccountMenu
      name={user.name}
      email={user.email}
      avatarUrl={user.avatarUrl}
    />
  );
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 hidden px-4 pt-4 lg:block lg:px-6 print:hidden">
      <div className="mx-auto flex h-[60px] w-full max-w-[1480px] items-center gap-3 rounded-2xl border border-line bg-panel/85 px-3 shadow-panel backdrop-blur-xl">
        <SidebarToggle />

        <div className="min-w-0 flex-1">
          <Breadcrumbs />
        </div>

        <TopbarSearch />

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/events/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-nav focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25 sm:px-3.5 sm:text-[12.5px]"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden xl:inline">New event</span>
          </Link>

          <NotificationBell />

          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />

          <Suspense
            fallback={
              <span
                aria-hidden="true"
                className="h-9 w-9 animate-pulse rounded-full bg-sunken"
              />
            }
          >
            <AccountArea />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
