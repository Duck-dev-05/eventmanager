"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/lib/notification-actions";

type UnreadState =
  | { count: number; loading: boolean }
  | { count: null; loading: false };

export function useUnreadNotifications() {
  const [unread, setUnread] = useState<UnreadState>({ count: 0, loading: true });
  const router = useRouter();
  const ref = useRef<typeof setUnread>(setUnread);

  useEffect(() => {
    ref.current = setUnread;
  }, [ref]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/notifications/unread");
        if (cancelled) return;
        const data = (await res.json().catch(() => null)) as { count?: number } | null;
        const count = Number(data?.count ?? 0);
        if (!cancelled) ref.current({ count, loading: false });
      } catch {
        if (!cancelled) ref.current({ count: 0, loading: false });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const result = await markAllNotificationsRead(undefined);
      if (!result?.success) return;

      ref.current({ count: 0, loading: false });
      router.refresh();
    } catch {
      // Keep the previous count; the action already revalidates on success.
    }
  }, [router]);

  return { unread, markAllRead };
}
