import type { ReactNode } from "react";

/** Small status banner for client sections that used to call window.alert(). */
export function InlineNotice({
  tone,
  children,
  className = "mx-5 mb-3 mt-3",
}: {
  tone: "error" | "success";
  children: ReactNode;
  className?: string;
}) {
  const palette =
    tone === "error"
      ? "border-rose-100 bg-rose-50 text-rose-600"
      : "border-emerald-100 bg-emerald-50 text-emerald-700";

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`${className} rounded-xl border px-4 py-2.5 text-[12.5px] font-medium ${palette}`}
    >
      {children}
    </p>
  );
}
