"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "eventpulse:sidebar";
const listeners = new Set<() => void>();
/**
 * Only animate after the first manual toggle: a restored collapsed state should
 * snap into place on page load instead of sliding across the screen.
 */
let animateChanges = false;

function readStoredValue() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "collapsed"
      ? "collapsed"
      : "open";
  } catch {
    return "open";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getServerSnapshot() {
  return "open";
}

function writeSidebarValue(next: "open" | "collapsed") {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode or blocked storage: the toggle still works in memory.
  }
  for (const listener of listeners) listener();
}

type SidebarState = {
  collapsed: boolean;
  animate: boolean;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarState>({
  collapsed: false,
  animate: false,
  toggle: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

/**
 * Owns whether the desktop sidebar is expanded or a narrow icon rail so the
 * sidebar itself and the topbar toggle stay in sync. The choice is remembered
 * across reloads.
 */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const stored = useSyncExternalStore(
    subscribe,
    readStoredValue,
    getServerSnapshot,
  );
  const collapsed = stored === "collapsed";

  const toggle = useCallback(() => {
    animateChanges = true;
    writeSidebarValue(collapsed ? "open" : "collapsed");
  }, [collapsed]);

  const value = useMemo(
    () => ({ collapsed, animate: animateChanges, toggle }),
    [collapsed, toggle],
  );

  return (
    <SidebarContext.Provider value={value}>
      {sidebar}
      <div
        className={`min-h-screen print:min-h-0 print:pl-0 ${
          value.animate
            ? "transition-[padding] duration-300 ease-out motion-reduce:transition-none"
            : ""
        } ${collapsed ? "lg:pl-[100px]" : "lg:pl-[292px]"}`}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}
