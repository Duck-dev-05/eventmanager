import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { PrimaryLink } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { listTemplatesForUser, formatTemplateDuration } from "@/lib/templates";
import { getSessionUser } from "@/lib/session-cookie";

export const instant = false;

export default async function TemplatesPage() {
  await connection();

  const user = await getSessionUser();
  const templates = user ? await listTemplatesForUser(user.id) : [];
  const customCount = templates.filter((template) => template.isCustom).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Library"
        title="Templates"
        description={
          customCount > 0
            ? `${customCount} saved ${customCount === 1 ? "template" : "templates"} plus the built-in presets.`
            : "Start from a battle-tested event structure and adapt it to your team's needs."
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/templates/new"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <PlusIcon className="h-4 w-4" />
              New template
            </Link>
            <PrimaryLink href="/events/new">
              <PlusIcon className="h-4 w-4" />
              Start from scratch
            </PrimaryLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <article
            key={template.id}
            className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02] transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-900/5"
          >
            <div>
              <div
                className={`relative flex h-36 flex-col justify-end bg-gradient-to-br p-6 text-white ${template.gradient}`}
              >
                <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2.5 py-0.5 text-[10.5px] font-semibold backdrop-blur-xs">
                  {template.badge}
                </span>
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  {template.category}
                </span>
                <h3 className="mt-1 text-[18px] font-bold tracking-tight text-white">
                  {template.name}
                </h3>
              </div>

              <div className="p-6">
                <p className="line-clamp-3 text-[13px] leading-relaxed text-zinc-600">
                  {template.description || "No description added yet."}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-500">
                  <span className="rounded-lg bg-zinc-100 px-2 py-1 font-medium">
                    {template.agendaPresets.length} agenda slots
                  </span>
                  <span className="rounded-lg bg-zinc-100 px-2 py-1 font-medium">
                    {template.taskPresets.length} checklist tasks
                  </span>
                  <span className="rounded-lg bg-zinc-100 px-2 py-1 font-medium">
                    {formatTemplateDuration(template.defaultDurationMinutes)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
              <Link
                href={`/templates/${template.id}`}
                className="text-[13px] font-semibold text-zinc-700 transition hover:text-zinc-900"
              >
                Preview blueprint
              </Link>
              <Link
                href={`/events/new?templateId=${template.id}`}
                className="inline-flex items-center gap-1 rounded-xl bg-[#193b30] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#245241]"
              >
                Use template →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
