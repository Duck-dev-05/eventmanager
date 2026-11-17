"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { eventCategories } from "./event-types";
import { getSessionUser } from "./session-cookie";

export type TemplateFormState =
  | {
      error?: string;
      values?: {
        name?: string;
        category?: string;
        description?: string;
        venue?: string;
        capacity?: string;
      };
    }
  | undefined;

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createTemplate(
  _state: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const values = {
    name: text(formData.get("name")),
    category: text(formData.get("category")),
    description: text(formData.get("description")),
    venue: text(formData.get("venue")),
    capacity: text(formData.get("capacity")),
  };

  if (values.name.length < 3) {
    return {
      error: "Give your template a name of at least 3 characters.",
      values,
    };
  }

  if (values.name.length > 80) {
    return { error: "Keep the template name under 80 characters.", values };
  }

  let capacity: number | null = null;
  if (values.capacity) {
    const parsed = Number(values.capacity);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100_000) {
      return {
        error: "Suggested capacity must be a whole number between 1 and 100,000.",
        values,
      };
    }
    capacity = parsed;
  }

  const category = eventCategories.includes(values.category)
    ? values.category
    : "Other";

  const id = randomUUID();

  getDb()
    .prepare(
      `INSERT INTO event_templates
        (id, owner_id, name, category, description, default_venue,
         default_capacity, default_duration_minutes, structure_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      user.id,
      values.name,
      category,
      values.description,
      values.venue,
      capacity,
      60,
      JSON.stringify({ agendaPresets: [], taskPresets: [] }),
      new Date().toISOString(),
    );

  revalidatePath("/templates");
  redirect(`/templates/${id}`);
}

export async function deleteTemplate(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const templateId = text(formData.get("templateId"));
  if (!templateId) redirect("/templates");

  getDb()
    .prepare(`DELETE FROM event_templates WHERE id = ? AND owner_id = ?`)
    .run(templateId, user.id);

  revalidatePath("/templates");
  redirect("/templates");
}
