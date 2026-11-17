import Link from "next/link";
import { connection } from "next/server";
import { EventForm } from "@/components/event-form";
import { PageHeader } from "@/components/page-header";
import { secondaryButton } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { publishEvent } from "@/lib/event-actions";
import { getPreferences } from "@/lib/preferences";
import { getSessionUser } from "@/lib/session-cookie";
import { getTemplateForUser } from "@/lib/templates";

export const instant = false;

export default async function NewEventPage({
  searchParams,
}: {
  searchParams?: Promise<{ templateId?: string }>;
}) {
  await connection();
  const { templateId } = (await searchParams) ?? {};

  const user = await getSessionUser();
  const preferences = user ? await getPreferences(user.id) : null;
  const template =
    templateId && user ? await getTemplateForUser(templateId, user.id) : null;

  const initialValues = {
    title: template ? `${template.name}` : "",
    description: template ? template.description : "",
    category: template ? template.category : "Conference",
    venue: template ? template.defaultVenue : "",
    capacity: template?.defaultCapacity
      ? String(template.defaultCapacity)
      : preferences?.defaultCapacity
        ? String(preferences.defaultCapacity)
        : "",
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title={template ? `Create from “${template.name}”` : "Create event"}
        description={
          template
            ? "Template defaults have been pre-filled below. Adjust the schedule and venue to fit."
            : "Set up the essentials now — you can fine-tune guest details later."
        }
        action={
          <Link href="/my-events" className={secondaryButton}>
            <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
            My events
          </Link>
        }
      />

      <EventForm
        action={publishEvent}
        initialValues={initialValues}
        templateId={template?.id}
      />
    </div>
  );
}
