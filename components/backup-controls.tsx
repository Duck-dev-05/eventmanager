"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui";

const CHUNK_CHARS = 400_000;
const CHUNK_UPLOAD_THRESHOLD = 800_000;

function chunkedRestoreId() {
  return crypto.randomUUID();
}

async function uploadBackupChunks(backup: Record<string, unknown>, restoreId: string) {
  const files = backup.files;
  const attachmentLengths: Record<string, number> = {};
  if (!Array.isArray(files)) return attachmentLengths;
  for (const file of files) {
    if (!file || typeof file !== "object" || typeof file.key !== "string" || typeof file.data !== "string" || !file.data.length) continue;
    attachmentLengths[file.key] = file.data.length;
    const count = Math.ceil(file.data.length / CHUNK_CHARS);
    if (count > 100) throw new Error("A file in this backup is too large to restore from the website.");
    for (let index = 0; index < count; index++) {
      const response = await fetch("/api/backup/chunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreId, key: file.key, index, count, data: file.data.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS) }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not upload a backup attachment.");
    }
    file.data = "";
  }
  return attachmentLengths;
}

export function BackupControls({ isOwner }: { isOwner: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function downloadBackup() {
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/backup", { cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Could not create a backup.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `eventpulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Full workspace backup downloaded. Keep it somewhere safe; it contains account data and uploaded files.");
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Could not create a backup.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup(file: File) {
    if (!window.confirm("Restore this backup? It will replace all users, events, settings, and uploaded files in this workspace. This cannot be undone.")) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    setMessage("");
    setError(false);
    let restoreId: string | null = null;
    try {
      const backup = JSON.parse(await file.text()) as Record<string, unknown>;
      const files = backup.files;
      if (!Array.isArray(files)) throw new Error("This backup does not contain an attachment list.");
      const attachmentDataSize = files.reduce((total, entry) => total + (entry && typeof entry === "object" && typeof entry.data === "string" ? entry.data.length : 0), 0);
      let attachmentLengths: Record<string, number> = {};
      if (attachmentDataSize > CHUNK_UPLOAD_THRESHOLD) {
        restoreId = chunkedRestoreId();
        attachmentLengths = await uploadBackupChunks(backup, restoreId);
      }
      const response = await fetch("/api/backup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreId, attachmentLengths, backup }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not restore this backup.");
      setMessage("Workspace restored successfully. Sign in again if the restored account changed.");
      window.setTimeout(() => window.location.reload(), 1500);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Could not restore this backup.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!isOwner) {
    return <p className="text-[12.5px] leading-relaxed text-zinc-500">Full workspace backup and restore are available to the workspace owner.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-zinc-500">
        Export or restore every workspace account, event, setting, and uploaded attachment. Backups contain sensitive account data; store them securely. Restore replaces all current workspace data.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void downloadBackup()} disabled={busy} className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Working…" : "Download full backup"}
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60">
          Restore from backup
        </button>
        <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void restoreBackup(file);
        }} />
      </div>
      {message && <Alert tone={error ? "danger" : "success"}>{message}</Alert>}
    </div>
  );
}
