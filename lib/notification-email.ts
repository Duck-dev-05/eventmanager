import nodemailer from "nodemailer";
import { getEventTitle } from "./events.ts";
import { getPreferences } from "./preferences.ts";
import { findUserById } from "./users.ts";

export type EmailDelivery =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "delivery-failed" };

/**
 * Shared sender for short plain-text notifications. Invitations and password
 * resets keep their own richer copy, but everything transactional goes through
 * the same Gmail transport configuration.
 */
export async function sendPlainEmail({
  to,
  subject,
  lines,
}: {
  to: string;
  subject: string;
  lines: string[];
}): Promise<EmailDelivery> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    return { sent: false, reason: "not-configured" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailAppPassword },
  });

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_FROM || gmailUser,
      to,
      subject,
      text: lines.join("\n"),
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: "delivery-failed" };
  }
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Tells an assignee they were handed work. People who turned off email
 * updates are skipped, and self-assignment stays silent.
 */
export async function emailTaskAssignment({
  eventId,
  assigneeId,
  actorId,
  actorName,
  taskTitle,
  dueAt,
}: {
  eventId: string;
  assigneeId: string;
  actorId: string;
  actorName: string;
  taskTitle: string;
  dueAt: string | null;
}) {
  if (assigneeId === actorId) return;

  const [assignee, preferences, eventTitle] = await Promise.all([
    findUserById(assigneeId),
    getPreferences(assigneeId),
    getEventTitle(eventId),
  ]);

  if (!assignee || !preferences.emailUpdates) return;

  await sendPlainEmail({
    to: assignee.email,
    subject: `New task on ${eventTitle ?? "an event"}: ${taskTitle}`,
    lines: [
      `Hi ${assignee.name},`,
      "",
      `${actorName} assigned you a task on "${eventTitle ?? "an event"}".`,
      ``, `Task: ${taskTitle}`,
      dueAt ? `Due: ${dateFormatter.format(new Date(dueAt))}` : "No due date.",
      "",
      `Open the event: ${eventUrl(eventId)}`,
      "",
      "You can turn these emails off in Settings.",
    ],
  });
}

export function eventUrl(eventId: string) {
  const base = process.env.APP_URL?.trim().replace(/\/$/, "");
  return base ? `${base}/events/${eventId}` : `/events/${eventId}`;
}
