"use client";

import { PrinterIcon } from "./icons";
import { primaryButton } from "./ui";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`print:hidden ${primaryButton}`}
    >
      <PrinterIcon className="h-4 w-4" />
      Print run sheet
    </button>
  );
}
