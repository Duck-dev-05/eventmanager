import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { secondaryButton } from "@/components/ui";
import { DeleteTemplateForm } from "@/components/delete-template-form";
import {
  CalendarDotsIcon,
  CheckCircleSolidIcon,
  ChevronLeftIcon,
  ClockIcon,
  MapPinIcon,
  UsersIcon,
} from "@/components/icons";
import { formatTemplateDuration, getTemplateForUser } from "@/lib/templates";
import { getSessionUser } from "@/lib/session-cookie";

export const instant = false;

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await connection();

  const user = await getSessionUser();
  const template = user ? await getTemplateForUser(id, user.id) : null;
  if (!template) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={template.isCustom ? "Your template" : "Templates"}
        title={template.name}
        description={template.description || "A reusable blueprint for your team."}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/templates" className={secondaryButton}>
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              All templates
            </Link>
            {template.isCustom ? (
              <DeleteTemplateForm
                templateId={template.id}
                templateName={template.name}
              />
            ) : null}
            <Link
              href={`/events/new?templateId=${template.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#193b30] px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-[#245241]"
            >
              Use this template
            </Link>
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <ClockIcon className="h-4 w-4 text-indigo-500" />
            Typical Duration
          </p>
          <p className="mt-2 text-[20px] font-bold text-zinc-900">
            {formatTemplateDuration(template.defaultDurationMinutes)}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            {template.defaultDurationMinutes} minutes total window
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <UsersIcon className="h-4 w-4 text-emerald-500" />
            Suggested Capacity
          </p>
          <p className="mt-2 text-[20px] font-bold text-zinc-900">
            {template.defaultCapacity
              ? `~${template.defaultCapacity} guests`
              : "Flexible"}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-500">Configurable upon creation</p>
        </div>

        <div className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <MapPinIcon className="h-4 w-4 text-orange-500" />
            Venue Recommendation
          </p>
          <p className="mt-2 truncate text-[17px] font-bold text-zinc-900">
            {template.defaultVenue || "Any venue"}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-500">Suggested space type</p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        {/* Preset Agenda Timeline */}
        <section className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
              <CalendarDotsIcon className="h-4 w-4 text-indigo-600" />
              Agenda Schedule ({template.agendaPresets.length} slots)
            </h2>
          </div>

          {template.agendaPresets.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-6 text-center text-[12.5px] leading-relaxed text-zinc-500">
              This template does not define agenda slots yet. Starting an event
              from it pre-fills the title, category, venue and capacity.
            </p>
          ) : (
            <ol className="relative mt-6 space-y-6 border-l border-zinc-200 pl-6">
              {template.agendaPresets.map((slot, index) => (
                <li key={`${slot.title}-${index}`} className="relative">
                  <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600 ring-4 ring-white">
                    {index + 1}
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-[14px] font-semibold text-zinc-900">
                      {slot.title}
                    </h3>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                      {slot.durationMinutes} min
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
                    {slot.description}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Preset Task Checklist */}
        <section className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
              <CheckCircleSolidIcon className="h-4 w-4 text-emerald-600" />
              Starter Checklist ({template.taskPresets.length} tasks)
            </h2>
          </div>

          {template.taskPresets.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-6 text-center text-[12.5px] leading-relaxed text-zinc-500">
              No starter tasks saved with this template yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100">
              {template.taskPresets.map((task, index) => (
                <li key={`${task.title}-${index}`} className="py-3.5">
                  <p className="text-[13.5px] font-medium text-zinc-900">
                    {task.title}
                  </p>
                  {task.notes ? (
                    <p className="mt-0.5 text-[12px] text-zinc-500">
                      {task.notes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 rounded-2xl bg-indigo-50/70 p-5 ring-1 ring-inset ring-indigo-100">
            <h4 className="text-[13px] font-semibold text-indigo-900">
              Ready to launch this event?
            </h4>
            <p className="mt-1 text-[12px] leading-relaxed text-indigo-700/80">
              Clicking &ldquo;Use this template&rdquo; pre-populates your event
              title, description, category, venue and capacity from this
              blueprint.
            </p>
            <Link
              href={`/events/new?templateId=${template.id}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Start event with this template
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
