"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  FileTextIcon,
  PlusIcon,
  UploadIcon,
} from "@/components/icons";
import { shortDate } from "@/lib/event-format";
import { MAX_FILE_BYTES, type EventFile } from "@/lib/file-types";
import { PptxPreview } from "./pptx-preview";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionLabel(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  const extension = dot > 0 ? fileName.slice(dot + 1) : "";
  if (!extension || extension.length > 5) return "FILE";
  return extension.toUpperCase();
}

type PreviewKind =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "text"
  | "pptx"
  | "none";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function isPptx(mimeType: string, fileName: string) {
  const name = fileName.toLowerCase();
  return (
    mimeType === PPTX_MIME || /\.(pptx|pptm|potx|potm)$/.test(name)
  );
}

function previewKind(mimeType: string, fileName: string): PreviewKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (isPptx(mimeType, fileName)) return "pptx";
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    return "text";
  }
  return "none";
}

export function EventFilesClient({
  eventId,
  files,
  canUpload,
  canDelete,
}: {
  eventId: string;
  files: EventFile[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    file: EventFile;
    text?: string;
  } | null>(null);

  useEffect(() => {
    if (!preview) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPreview(null);
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [preview]);

  async function upload(fileList: FileList | File[]) {
    const selected = Array.from(fileList);
    if (selected.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      for (const file of selected) {
        if (file.size > MAX_FILE_BYTES) {
          throw new Error(`“${file.name}” is larger than 20 MB.`);
        }

        const body = new FormData();
        body.append("file", file);

        const response = await fetch(`/api/events/${eventId}/files`, {
          method: "POST",
          body,
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error ?? `Could not upload “${file.name}”.`);
        }
      }

      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openPreview(file: EventFile) {
    const kind = previewKind(file.mimeType, file.name);

    if (kind === "none") {
      setPreview({ file });
      return;
    }

    if (kind !== "text") {
      setPreview({ file });
      return;
    }

    setError(null);
    try {
      const response = await fetch(
        `/api/events/${eventId}/files/${file.id}?inline=1`,
      );
      if (!response.ok) throw new Error("Could not open this file.");
      const text = await response.text();
      setPreview({ file, text: text.slice(0, 100_000) });
    } catch (previewError) {
      setError(
        previewError instanceof Error ? previewError.message : "Preview failed.",
      );
    }
  }

  async function remove(file: EventFile) {
    if (!confirm(`Delete “${file.name}”? This cannot be undone.`)) return;

    setBusy(file.id);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}/files/${file.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "Could not delete this file.");
      }

      if (preview?.file.id === file.id) setPreview(null);
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Delete failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="space-y-6">
        {canUpload ? (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (uploading) return;
              void upload(event.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-10 ${
              dragging
                ? "border-[#d9773e] bg-[#fffaf2]"
                : "border-[#e4e1d8] bg-white"
            }`}
          >
            <span
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                dragging
                  ? "bg-[#fdf0e4] text-[#c96532]"
                  : "bg-[#f4f2ec] text-[#5f6b63]"
              }`}
            >
              <UploadIcon className="h-5 w-5" />
            </span>

            <p className="mt-4 text-[14px] font-semibold tracking-tight text-[#18231d]">
              {dragging ? "Drop files to upload" : "Drag & drop files here"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-zinc-500">
              Any file type — documents, images, video, audio or archives. Up to
              20 MB per file.
            </p>

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#193b30] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#22493c] disabled:opacity-60"
              >
                <PlusIcon className="h-4 w-4" />
                {uploading ? "Uploading…" : "Choose files"}
              </button>
              <span className="text-[11.5px] text-zinc-400">
                or drop them above
              </span>
            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) void upload(event.target.files);
              }}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e8e6de] bg-white px-5 py-4">
            <p className="text-[12.5px] text-zinc-500">
              Files shared with the whole team. Only the owner and admins can
              upload or delete them.
            </p>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-500">
              Read-only
            </span>
          </div>
        )}

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-[12.5px] font-medium text-rose-600"
          >
            {error}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
          <div className="flex items-center justify-between gap-3 border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
            <div>
              <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">
                Event files
              </h2>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                {files.length === 0
                  ? "Nothing uploaded yet."
                  : `${files.length} ${files.length === 1 ? "file" : "files"} shared with the team.`}
              </p>
            </div>
          </div>

          <ul className="divide-y divide-[#f2efe8]">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4f2ec] text-[10px] font-bold uppercase tracking-wide text-[#5f6b63]">
                  {extensionLabel(file.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => void openPreview(file)}
                    className="block max-w-full truncate text-left text-[13.5px] font-medium text-zinc-900 underline-offset-2 transition-colors hover:text-[#193b30] hover:underline"
                  >
                    {file.name}
                  </button>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-zinc-400">
                    <span>{formatBytes(file.sizeBytes)}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-300" />
                    <span>{file.uploaderName}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-300" />
                    <span>{shortDate.format(new Date(file.createdAt))}</span>
                  </p>
                </div>

                <a
                  href={`/api/events/${eventId}/files/${file.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11.5px] font-semibold text-zinc-600 transition-colors hover:border-[#d5cfc2] hover:bg-[#faf8f3] hover:text-[#193b30]"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Download
                </a>

                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => remove(file)}
                    disabled={busy === file.id}
                    className="rounded-lg border border-transparent px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    {busy === file.id ? "Deleting…" : "Delete"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {files.length === 0 ? (
            <p className="border-t border-[#f0ede5] px-5 py-6 text-center text-[12.5px] text-zinc-400">
              Uploaded briefs, floor plans and photos will be listed here with
              who added them.
            </p>
          ) : null}
        </div>
      </section>

      {preview ? (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPreview(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${preview.file.name}`}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4f2ec] text-[10px] font-bold uppercase text-[#5f6b63]">
                {extensionLabel(preview.file.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-zinc-900">
                  {preview.file.name}
                </p>
                <p className="text-[11.5px] text-zinc-400">
                  {formatBytes(preview.file.sizeBytes)} ·{" "}
                  {preview.file.uploaderName}
                </p>
              </div>
              <a
                href={`/api/events/${eventId}/files/${preview.file.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11.5px] font-semibold text-zinc-600 transition-colors hover:bg-[#faf8f3]"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                Download
              </a>
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Close preview"
                className="rounded-lg px-2 py-1 text-lg leading-none text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-[240px] flex-1 items-center justify-center overflow-auto bg-[#faf9f5] p-4">
              {(() => {
                const url = `/api/events/${eventId}/files/${preview.file.id}?inline=1`;
                const kind = previewKind(
                  preview.file.mimeType,
                  preview.file.name,
                );

                if (kind === "image") {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={preview.file.name}
                      className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
                    />
                  );
                }

                if (kind === "pdf") {
                  return (
                    <iframe
                      src={url}
                      title={preview.file.name}
                      className="h-[70vh] w-full rounded-lg bg-white ring-1 ring-inset ring-zinc-200"
                    />
                  );
                }

                if (kind === "video") {
                  return (
                    <video
                      src={url}
                      controls
                      className="max-h-[70vh] w-full rounded-lg bg-black"
                    />
                  );
                }

                if (kind === "audio") {
                  return (
                    <div className="w-full max-w-lg rounded-xl bg-white p-4 ring-1 ring-inset ring-zinc-200">
                      <audio src={url} controls className="w-full" />
                    </div>
                  );
                }

                if (kind === "text" && preview.text !== undefined) {
                  return (
                    <pre className="max-h-[70vh] w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-4 text-[12px] leading-relaxed text-zinc-700 ring-1 ring-inset ring-zinc-200">
                      {preview.text}
                    </pre>
                  );
                }

                if (kind === "pptx") {
                  return (
                    <PptxPreview src={url} title={preview.file.name} />
                  );
                }

                const legacyPowerPoint = /\.ppt$/i.test(preview.file.name);

                return (
                  <div className="max-w-sm text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#5f6b63] ring-1 ring-inset ring-zinc-200">
                      <FileTextIcon className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-[13px] font-semibold text-zinc-800">
                      {legacyPowerPoint
                        ? "Legacy .ppt can't be previewed"
                        : "No preview for this format"}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
                      {legacyPowerPoint
                        ? "Save the presentation as .pptx and upload it again to preview slides here."
                        : `${preview.file.mimeType} can't be shown in the browser. Download it to open with the right app.`}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
