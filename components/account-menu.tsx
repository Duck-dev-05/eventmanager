"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-actions";
import { initialsOf } from "@/lib/initials";
import { Avatar } from "./avatar";
import {
  BellIcon,
  ChevronDownIcon,
  HelpCircleIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "./icons";

const menuItems = [
  { href: "/profile", label: "Your profile", Icon: UserIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
  { href: "/notifications", label: "Notifications", Icon: BellIcon },
  { href: "/help", label: "Help & support", Icon: HelpCircleIcon },
];

export function AccountMenu({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-accent/40 ${
          open ? "bg-sunken" : "hover:bg-sunken"
        }`}
      >
        <Avatar initials={initialsOf(name)} src={avatarUrl} size="md" />
        <span className="hidden max-w-[128px] truncate text-[12.5px] font-medium text-ink-soft sm:block">
          {name}
        </span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 text-faint transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-line bg-panel p-1.5 shadow-float"
        >
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-sunken"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink">
                {name}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                {email}
              </span>
            </span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-inset ring-accent-line">
              View
            </span>
          </Link>

          <div className="my-1 h-px bg-line-soft" />

          {menuItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              aria-current={isActive(href) ? "page" : undefined}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-medium transition-colors ${
                isActive(href)
                  ? "bg-accent-soft text-ink"
                  : "text-ink-soft hover:bg-sunken hover:text-ink"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  isActive(href) ? "text-accent" : "text-faint"
                }`}
              />
              {label}
            </Link>
          ))}

          <div className="my-1 h-px bg-line-soft" />

          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOutIcon className="h-4 w-4 text-faint" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
