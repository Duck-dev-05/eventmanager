import { randomUUID } from "node:crypto";
import { logEventActivity } from "./activity.ts";
import { getDb } from "./db.ts";
import type { EventTemplate } from "./templates.ts";

/**
 * Fills a freshly created event with the template's agenda and checklist.
 * Agenda slots run back-to-back from the event start so the timeline is
 * immediately usable. Runs in one transaction: a partial blueprint is worse
 * than none.
 */
export async function seedEventFromTemplate({
  eventId,
  actorId,
  template,
  startsAt,
}: {
  eventId: string;
  actorId: string;
  template: EventTemplate;
  startsAt: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  let cursor = new Date(startsAt).getTime();
  if (Number.isNaN(cursor)) cursor = Date.now();

  const txn = await db.transaction();
  try {
    for (const [index, preset] of template.agendaPresets.entries()) {
      const duration = Math.max(
        5,
        Math.min(1440, Math.floor(Number(preset.durationMinutes) || 30)),
      );
      const start = new Date(cursor);
      cursor += duration * 60_000;

      await txn
        .prepare(
          `INSERT INTO event_agenda_items
             (id, event_id, title, description, starts_at, duration_minutes,
              location, speaker_name, status, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, '', '', 'scheduled', ?, ?)`,
        )
        .run(
          randomUUID(),
          eventId,
          preset.title.trim().slice(0, 140),
          preset.description.trim(),
          start.toISOString(),
          duration,
          index,
          now,
        );
    }

    for (const preset of template.taskPresets) {
      await txn
        .prepare(
          `INSERT INTO event_tasks
             (id, event_id, title, notes, status, assignee_id, due_at, created_by, created_at)
           VALUES (?, ?, ?, ?, 'open', NULL, NULL, ?, ?)`,
        )
        .run(
          randomUUID(),
          eventId,
          preset.title.trim().slice(0, 140),
          preset.notes.trim(),
          actorId,
          now,
        );
    }

    await txn.commit();
  } catch (error) {
    await txn.rollback().catch(() => {});
    throw error;
  }

  await logEventActivity({
    eventId,
    actorId,
    kind: "agenda",
    summary: `set up ${template.agendaPresets.length} agenda slot${template.agendaPresets.length === 1 ? "" : "s"} and ${template.taskPresets.length} task${template.taskPresets.length === 1 ? "" : "s"} from “${template.name}”`,
  });
}
