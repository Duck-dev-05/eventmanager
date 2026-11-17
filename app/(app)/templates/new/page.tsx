import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TemplateForm } from "@/components/template-form";
import { secondaryButton } from "@/components/ui";
import { ChevronRightIcon, ColumnsIcon } from "@/components/icons";

export default function NewTemplatePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Library"
        title="Create template"
        description="Design a reusable event blueprint for your team with preset categories, venues, and schedules."
        action={
          <Link href="/templates" className={secondaryButton}>
            <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
            All templates
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <TemplateForm />

        <aside className="space-y-5">
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <ColumnsIcon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-[14.5px] font-semibold text-indigo-950">
              Why use templates?
            </h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-indigo-800/80">
              Templates standardize run sheets and checklists across your
              organization. Whenever someone organizes a recurring workshop,
              meetup, or quarterly review, they save hours of manual preparation.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm">
            <h3 className="text-[13.5px] font-semibold text-zinc-900">
              Saved to your account
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
              Templates you create are private to you and appear alongside the
              built-in presets in this library.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
