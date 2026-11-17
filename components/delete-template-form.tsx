"use client";

import { deleteTemplate } from "@/lib/template-actions";

export function DeleteTemplateForm({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  return (
    <form
      action={deleteTemplate}
      onSubmit={(event) => {
        if (!window.confirm(`Delete “${templateName}”? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="templateId" value={templateId} />
      <button
        type="submit"
        className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-100"
      >
        Delete template
      </button>
    </form>
  );
}
