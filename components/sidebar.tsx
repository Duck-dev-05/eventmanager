"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-actions";
import {
  CalendarDotsIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ColumnsIcon,
  GridIcon,
  HelpCircleIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
  PlusIcon,
  PulseIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "./icons";
import { useSidebar } from "./app-shell";
import { NotificationBell } from "./notification-bell";

const navItems = [
  { href: "/dashboard", label: "Dashboard", Icon: GridIcon },
  { href: "/my-events", label: "My Events", Icon: CalendarIcon },
  { href: "/invitations", label: "Invitations", Icon: MailIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarDotsIcon },
  { href: "/users", label: "Users", Icon: UsersIcon },
  { href: "/my-activity", label: "My Activity", Icon: PulseIcon },
];

const accountLinks = [
  { href: "/profile", label: "Your profile", Icon: UserIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
  { href: "/help", label: "Help & support", Icon: HelpCircleIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#e08a4b] to-accent text-white shadow-sm shadow-accent/30 ring-1 ring-inset ring-white/30">
        <CalendarIcon className="h-[18px] w-[18px]" />
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-tight tracking-tight text-ink">
            EventPulse
          </span>
          <span className="block truncate font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-faint">
            Event workspace
          </span>
        </span>
      )}
    </span>
  );
}

function NavItem({
  href,
  label,
  Icon,
  active,
  collapsed = false,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2.5 rounded-xl py-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        collapsed ? "justify-center px-0" : "px-3"
      } ${
        active
          ? "bg-accent-soft font-semibold text-ink ring-1 ring-inset ring-accent-line"
          : "font-medium text-ink-soft hover:bg-sunken hover:text-ink"
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
          active ? "text-accent" : "text-faint group-hover:text-ink-soft"
        }`}
      />
      {collapsed ? null : <span className="truncate">{label}</span>}
    </Link>
  );
}

function IconAction({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <Icon className="h-[18px] w-[18px]" />
    </Link>
  );
}

export function Sidebar({ account }: { account?: ReactNode }) {
  const pathname = usePathname();
  const { collapsed, animate, toggle } = useSidebar();

  return (
    <aside
      className={`fixed inset-y-3 left-3 z-40 hidden flex-col overflow-hidden rounded-[26px] border border-line bg-panel/95 shadow-float backdrop-blur-xl print:hidden lg:flex ${
        animate
          ? "transition-[width] duration-300 ease-out motion-reduce:transition-none"
          : ""
      } ${collapsed ? "w-[76px]" : "w-[268px]"}`}
    >
      <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
        <div
          className={`flex items-center ${
            collapsed ? "flex-col gap-3" : "justify-between gap-2"
          }`}
        >
          <Link
            href="/dashboard"
            className="min-w-0 rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Brand compact={collapsed} />
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ChevronLeftIcon
              className={`h-4 w-4 transition-transform duration-300 ${
                collapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        <Link
          href="/events/new"
          title={collapsed ? "Create event" : undefined}
          aria-label={collapsed ? "Create event" : undefined}
          className={`mt-6 flex items-center justify-center gap-2 rounded-xl bg-accent text-[13px] font-semibold text-white shadow-sm shadow-accent/25 transition-colors hover:bg-[#b95c26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
            collapsed ? "h-11" : "px-4 py-2.5"
          }`}
        >
          <PlusIcon className="h-4 w-4 shrink-0" />
          {collapsed ? null : "Create event"}
        </Link>

        <nav
          aria-label="Workspace"
          className="mt-6 min-h-0 flex-1 overflow-y-auto pr-0.5"
        >
          <ul className="space-y-0.5">
            {navItems.map(({ href, label, Icon }) => (
              <li key={href}>
                <NavItem
                  href={href}
                  label={label}
                  Icon={Icon}
                  active={isActive(pathname, href)}
                  collapsed={collapsed}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-4 border-t border-line-soft pt-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-0.5">
              <IconAction href="/profile" label="Your profile" Icon={UserIcon} />
              <IconAction href="/settings" label="Settings" Icon={SettingsIcon} />
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <LogOutIcon className="h-[18px] w-[18px]" />
                </button>
              </form>
            </div>
          ) : (
            account
          )}
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="sticky top-0 z-30 px-3 pt-3 lg:hidden print:hidden">
      <div className="flex h-14 items-center justify-between gap-2 rounded-2xl border border-line bg-panel/90 px-2 shadow-panel backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <Link
            href="/dashboard"
            className="min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Brand compact />
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href="/search"
            aria-label="Search events and tasks"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <SearchIcon className="h-[18px] w-[18px]" />
          </Link>
          <NotificationBell />
          <Link
            href="/events/new"
            aria-label="Create event"
            className="ml-1 flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-[12px] font-semibold text-white shadow-sm shadow-accent/25 transition-colors hover:bg-[#b95c26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <PlusIcon className="h-4 w-4" />
            New
          </Link>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            className="relative z-10 my-2 ml-2 flex h-[calc(100%-1rem)] w-[292px] max-w-[85vw] flex-col overflow-y-auto rounded-[26px] border border-line bg-panel px-3 py-4 shadow-float"
          >
            <div className="flex items-center justify-between gap-2 pb-1">
              <Link
                href="/dashboard"
                onClick={() => setDrawerOpen(false)}
                className="min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Brand />
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <Link
              href="/events/new"
              onClick={() => setDrawerOpen(false)}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-accent/25 transition-colors hover:bg-[#b95c26]"
            >
              <PlusIcon className="h-4 w-4" />
              Create event
            </Link>

            <nav aria-label="Workspace" className="mt-5 min-h-0 flex-1">
              <ul className="space-y-0.5">
                {[...navItems, ...accountLinks].map(({ href, label, Icon }) => (
                  <li key={href}>
                    <NavItem
                      href={href}
                      label={label}
                      Icon={Icon}
                      active={isActive(pathname, href)}
                      onNavigate={() => setDrawerOpen(false)}
                    />
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-4 border-t border-line-soft pt-3">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
                >
                  <LogOutIcon className="h-[18px] w-[18px] text-faint" />
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
