"use client";

import { useEffect, useRef } from "react";
import { SearchIcon } from "./icons";

export function TopbarSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <form
      action="/search"
      method="GET"
      role="search"
      className="relative w-full max-w-[320px]"
    >
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        type="search"
        name="q"
        aria-label="Search events, tasks, people and files"
        placeholder="Search everything..."
        className="h-10 w-full rounded-xl border border-line bg-sunken/70 pl-9 pr-14 text-[13px] text-ink placeholder:text-faint outline-none transition focus:border-accent/60 focus:bg-panel focus:ring-2 focus:ring-accent/15"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-panel px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
        ⌘K
      </kbd>
    </form>
  );
}
