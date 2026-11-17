import { getDb } from "./db";

export type Preferences = {
  eventReminders: boolean;
  emailUpdates: boolean;
  weeklyDigest: boolean;
  defaultCapacity: number | null;
  updatedAt: string | null;
};

export const defaultPreferences: Preferences = {
  eventReminders: true,
  emailUpdates: true,
  weeklyDigest: false,
  defaultCapacity: null,
  updatedAt: null,
};

type PreferenceRow = {
  event_reminders: number;
  email_updates: number;
  weekly_digest: number;
  default_capacity: number | null;
  updated_at: string;
};

export async function getPreferences(userId: string): Promise<Preferences> {
  const row = getDb()
    .prepare(
      `SELECT event_reminders, email_updates, weekly_digest, default_capacity, updated_at
       FROM user_preferences
       WHERE user_id = ?`,
    )
    .get(userId) as PreferenceRow | undefined;

  if (!row) return defaultPreferences;

  return {
    eventReminders: row.event_reminders === 1,
    emailUpdates: row.email_updates === 1,
    weeklyDigest: row.weekly_digest === 1,
    defaultCapacity: row.default_capacity,
    updatedAt: row.updated_at,
  };
}

export async function savePreferences(
  userId: string,
  values: Omit<Preferences, "updatedAt">,
): Promise<Preferences> {
  const updatedAt = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO user_preferences
         (user_id, event_reminders, email_updates, weekly_digest, default_capacity, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         event_reminders = excluded.event_reminders,
         email_updates = excluded.email_updates,
         weekly_digest = excluded.weekly_digest,
         default_capacity = excluded.default_capacity,
         updated_at = excluded.updated_at`,
    )
    .run(
      userId,
      values.eventReminders ? 1 : 0,
      values.emailUpdates ? 1 : 0,
      values.weeklyDigest ? 1 : 0,
      values.defaultCapacity,
      updatedAt,
    );

  return { ...values, updatedAt };
}
