"use client";

import { useActionState, useState } from "react";
import { DesktopIcon } from "@/components/icons";
import {
  generateSyncTokenAction,
  revokeSyncDeviceAction,
  type SyncSettingsState,
} from "@/lib/sync-actions";
import type { SyncDeviceRow } from "@/lib/sync";

/**
 * Settings card for pairing the Event Manager Desktop app. Generates a
 * once-visible bearer token that the desktop app stores with the site URL.
 */
export function DesktopSyncCard({ devices }: { devices: SyncDeviceRow[] }) {
  const [state, formAction, pending] = useActionState<
    SyncSettingsState,
    FormData
  >(generateSyncTokenAction, undefined);
  const [copied, setCopied] = useState(false);

  async function copyToken() {
    if (!state?.token) return;
    try {
      await navigator.clipboard.writeText(state.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <DesktopIcon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Desktop app sync
          </h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">
            Pair Event Manager Desktop to keep your events in sync in real
            time, both ways.
          </p>
        </div>
      </div>

      {state?.token ? (
        <div className="mt-4">
          <p className="text-[12.5px] font-medium text-zinc-900">
            Pairing token for “{state.deviceName}”
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={state.token}
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Desktop pairing token"
              className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 font-mono text-[12px] text-indigo-900"
            />
            <button
              type="button"
              onClick={copyToken}
              className="rounded-xl bg-zinc-900 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              {copied ? "Copied" : "Copy token"}
            </button>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-400">
            Paste it into the desktop app’s Settings → Website sync, together
            with this site’s address. This token is shown only once — reload
            the page and generate a new one if you lose it.
          </p>
        </div>
      ) : (
        <form action={formAction} className="mt-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-indigo-600 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
          >
            {pending ? "Generating…" : "Generate pairing token"}
          </button>
        </form>
      )}

      {state?.error ? (
        <p className="mt-2 text-[12px] font-medium text-rose-600">{state.error}</p>
      ) : null}

      {devices.length > 0 ? (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <p className="text-[12px] font-semibold text-zinc-500">
            Paired devices
          </p>
          <ul className="mt-2 divide-y divide-zinc-100">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-zinc-900">
                    {device.name}
                  </span>
                  <span className="block text-[11.5px] text-zinc-400">
                    {device.lastSeenAt
                      ? `Last seen ${new Date(device.lastSeenAt).toLocaleString()}`
                      : "Never connected yet"}
                  </span>
                </span>
                <form action={revokeSyncDeviceAction}>
                  <input type="hidden" name="deviceId" value={device.id} />
                  <button
                    type="submit"
                    className="text-[12px] font-semibold text-zinc-400 transition-colors hover:text-rose-600"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
