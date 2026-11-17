"use client";

import { useSidebar } from "./app-shell";
import { MenuIcon } from "./icons";

export function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-panel text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 lg:inline-flex print:hidden"
    >
      <MenuIcon className="h-[17px] w-[17px]" />
    </button>
  );
}
