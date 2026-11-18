import Link from "next/link";
import { connection } from "next/server";
import { EventForm } from "@/components/event-form";
import { PageHeader } from "@/components/page-header";
import { secondaryButton } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { publishEvent } from "@/lib/event-actions";
import { getPreferences } from "@/lib/preferences";
import { getSessionUser } from "@/lib/session-cookie";

export const instant = false;

export default async function NewEventPage() {
  await connection();

  const user = await getSessionUser();
  const preferences = user ? await getPreferences(user.id) : null;

  const initialValues = {
    title: "",
    description: "",
    category: "Conference",
    venue: "",
    capacity: preferences?.defaultCapacity
      ? String(preferences.defaultCapacity)
      : "",
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="Create event"
        description="Set up the essentials now — you can fine-tune guest details later."
        action={
          <Link href="/my-events" className={secondaryButton}>
            <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
            My events
          </Link>
        }
      />

      <EventForm action={publishEvent} initialValues={initialValues} />
    </div>
  );
}
