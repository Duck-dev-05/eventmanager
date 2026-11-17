"use client";

import { useEffect, useRef, useState } from "react";

type ViewerHandle = { destroy?: () => void };

/** Renders a .pptx deck client-side; the renderer is imported only when used. */
export function PptxPreview({ src, title }: { src: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let viewer: ViewerHandle | null = null;

    async function load() {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("This presentation could not be loaded.");
        }

        const buffer = await response.arrayBuffer();
        const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import(
          "@aiden0z/pptx-renderer"
        );

        if (controller.signal.aborted || !containerRef.current) return;

        viewer = await PptxViewer.open(buffer, containerRef.current, {
          zipLimits: RECOMMENDED_ZIP_LIMITS,
          externalMedia: "block",
        });

        setStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "This deck could not be rendered.",
        );
      }
    }

    void load();

    return () => {
      controller.abort();
      viewer?.destroy?.();
    };
  }, [src]);

  return (
    <div className="relative w-full">
      {status === "loading" ? (
        <p className="absolute inset-x-0 top-3 z-10 text-center text-[12px] font-medium text-zinc-500">
          Loading slides…
        </p>
      ) : null}

      {status === "error" ? (
        <div className="mx-auto max-w-sm py-10 text-center">
          <p className="text-[13px] font-semibold text-zinc-800">
            This deck could not be rendered
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
            {message}
          </p>
        </div>
      ) : null}

      <div
        ref={containerRef}
        aria-label={`Slide preview of ${title}`}
        className="h-[70vh] w-full overflow-auto rounded-lg bg-white p-2 ring-1 ring-inset ring-zinc-200"
      />
    </div>
  );
}
