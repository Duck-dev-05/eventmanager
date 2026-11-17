#!/usr/bin/env node
/**
 * Scheduled notification job for EventPulse.
 *
 * Sends two kinds of email, each honouring the recipient's preferences:
 *   1. Event reminders — events starting in the next 24 hours.
 *   2. Weekly digest — the next 7 days of events for people who opted in.
 *
 * Runs outside Next, so it talks to the database directly through
 * @libsql/client — the same driver the app uses. Point LIBSQL_URL at the
 * hosted database (with LIBSQL_AUTH_TOKEN) or leave it unset to use the local
 * file database. Every send is recorded in `sent_email_log` so re-running the
 * job (cron overlap, a retry) never emails the same person twice for the same
 * event and day.
 *
 * Usage:
 *   npm run notify -- --dry-run   # print what would be sent
 *   npm run notify                # send anything outstanding
 */

import path from "node:path";
import { createClient } from "@libsql/client";
import nodemailer from "nodemailer";

const dryRun = process.argv.includes("--dry-run");

const databaseUrl =
  process.env.LIBSQL_URL?.trim() ||
  `file:${path.join(
    process.env.DATA_DIR?.trim()
      ? path.resolve(process.env.DATA_DIR.trim())
      : path.join(process.cwd(), "data"),
    "eventpulse.db",
  ).replace(/\\/g, "/")}`;

const authToken = process.env.LIBSQL_AUTH_TOKEN?.trim();

const db = authToken
  ? createClient({ url: databaseUrl, authToken })
  : createClient({ url: databaseUrl });

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
const transporter =
  gmailUser && gmailAppPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailAppPassword },
      })
    : null;

const appBase = process.env.APP_URL?.trim().replace(/\/$/, "") ?? "";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function eventLink(eventId) {
  return appBase ? `${appBase}/events/${eventId}` : `/events/${eventId}`;
}

async function preferencesFor(userId) {
  const result = await db.execute({
    sql: "SELECT event_reminders, weekly_digest FROM user_preferences WHERE user_id = ?",
    args: [userId],
  });
  const row = result.rows[0];

  return {
    reminders: row ? row.event_reminders === 1 : true,
    digest: row ? row.weekly_digest === 1 : false,
  };
}

async function alreadySent(key) {
  const result = await db.execute({
    sql: "SELECT 1 FROM sent_email_log WHERE key = ?",
    args: [key],
  });
  return result.rows.length > 0;
}

async function markSent(key) {
  await db.execute({
    sql: "INSERT OR REPLACE INTO sent_email_log (key, sent_at) VALUES (?, ?)",
    args: [key, new Date().toISOString()],
  });
}

async function deliver({ to, subject, lines, label }) {
  if (dryRun) {
    console.log(`[dry-run] would email ${to}: ${subject}`);
    return { ok: true, dryRun: true };
  }

  if (!transporter) {
    console.log(`[skip] email not configured; skipped ${label}`);
    return { ok: false, reason: "not-configured" };
  }

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_FROM || gmailUser,
      to,
      subject,
      text: lines.join("\n"),
    });
    console.log(`[sent] ${label}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "delivery failed";
    console.error(`[failed] ${label}: ${message}`);
    return { ok: false, reason: message };
  }
}

async function eventAttendees(eventId) {
  const result = await db.execute(
    `SELECT u.id, u.name, u.email
     FROM users u
     WHERE u.id = (SELECT owner_id FROM events WHERE id = ?)
     UNION
     SELECT u.id, u.name, u.email
     FROM users u
     JOIN event_members em ON em.user_id = u.id
     WHERE em.event_id = ? AND em.status = 'accepted'`,
    [eventId, eventId],
  );
  return result.rows;
}

async function sendReminders(now) {
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const events = await db.execute(
    `SELECT id, title, starts_at, venue
     FROM events
     WHERE starts_at >= ? AND starts_at <= ?
     ORDER BY starts_at ASC`,
    [now.toISOString(), until.toISOString()],
  );

  let delivered = 0;
  let failed = 0;

  for (const event of events.rows) {
    for (const person of await eventAttendees(event.id)) {
      const key = `reminder:${event.id}:${person.id}:${now.toISOString().slice(0, 10)}`;
      if (await alreadySent(key)) continue;
      if (!(await preferencesFor(person.id)).reminders) continue;

      const result = await deliver({
        to: person.email,
        subject: `Reminder: ${event.title} starts soon`,
        lines: [
          `Hi ${person.name},`,
          "",
          `"${event.title}" starts ${dateFormatter.format(new Date(event.starts_at))}.`,
          event.venue ? `Venue: ${event.venue}` : "Venue: to be announced.",
          "",
          `Details: ${eventLink(event.id)}`,
          "",
          "You can turn reminders off in Settings.",
        ],
        label: `reminder for ${event.title} -> ${person.email}`,
      });

      if (result.ok) {
        if (!dryRun) await markSent(key);
        delivered += 1;
      } else if (result.reason !== "not-configured") {
        failed += 1;
      }
    }
  }

  return { delivered, failed };
}

async function sendDigests(now) {
  const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const people = await db.execute(
    `SELECT u.id, u.name, u.email
     FROM users u
     JOIN user_preferences p ON p.user_id = u.id
     WHERE p.weekly_digest = 1`,
  );

  const week = weekKey(now);
  let delivered = 0;
  let failed = 0;

  for (const person of people.rows) {
    const key = `digest:${person.id}:${week}`;
    if (await alreadySent(key)) continue;

    const events = await db.execute(
      `SELECT e.id, e.title, e.starts_at, e.venue
       FROM events e
       WHERE e.starts_at >= ? AND e.starts_at <= ?
         AND (
           e.owner_id = ?
           OR EXISTS (
             SELECT 1 FROM event_members em
             WHERE em.event_id = e.id AND em.user_id = ? AND em.status = 'accepted'
           )
         )
       ORDER BY e.starts_at ASC`,
      [now.toISOString(), until.toISOString(), person.id, person.id],
    );

    if (events.rows.length === 0) continue;

    const result = await deliver({
      to: person.email,
      subject: `Your week: ${events.rows.length} event${events.rows.length === 1 ? "" : "s"}`,
      lines: [
        `Hi ${person.name},`,
        "",
        "Here is what is coming up in the next seven days:",
        "",
        ...events.rows.map(
          (event) =>
            `- ${event.title} · ${dateFormatter.format(new Date(event.starts_at))}${event.venue ? ` · ${event.venue}` : ""}\n  ${eventLink(event.id)}`,
        ),
        "",
        "You can turn the weekly digest off in Settings.",
      ],
      label: `weekly digest -> ${person.email}`,
    });

    if (result.ok) {
      if (!dryRun) await markSent(key);
      delivered += 1;
    } else if (result.reason !== "not-configured") {
      failed += 1;
    }
  }

  return { delivered, failed };
}

function weekKey(date) {
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

async function main() {
  const now = new Date();

  await db.execute({
    sql: "DELETE FROM sent_email_log WHERE sent_at < ?",
    args: [new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()],
  });

  const reminders = await sendReminders(now);
  const digests = await sendDigests(now);

  console.log(
    `\nDone${dryRun ? " (dry run)" : ""}: ${reminders.delivered} reminder(s), ${digests.delivered} digest(s), ${reminders.failed + digests.failed} failure(s).`,
  );

  if (reminders.failed + digests.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
