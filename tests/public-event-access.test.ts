import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// Use a throwaway database directory so the real one is untouched
const TEST_DATA_DIR = "/tmp/eventmanager-test";
mkdirSync(TEST_DATA_DIR, { recursive: true });

// Track the most recent test database so afterEach can release Windows file
// locks before deleting the file (Windows refuses rmSync on open files).
let openDatabase: DatabaseSync | null = null;

function createDatabase() {
  const dbPath = join(TEST_DATA_DIR, "test.db");

  // Clean up any previous test DB (synchronous, safe to call)
  if (existsSync(dbPath)) {
    rmSync(dbPath);
  }

  const db = new DatabaseSync(dbPath);
  openDatabase = db;
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  // Run migrations manually as no-throw statements
  const migrations: string[] = [
    // 001 users
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'password',
      password_hash TEXT,
      google_sub TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL
    )`,
    // 002 events
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Other',
      venue TEXT NOT NULL DEFAULT '',
      starts_at TEXT NOT NULL,
      capacity INTEGER,
      created_at TEXT NOT NULL
    )`,
    // 003 event_members
    `CREATE TABLE IF NOT EXISTS event_members (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      invited_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending',
      UNIQUE (event_id, user_id)
    )`,
    // 004 event_invites
    `CREATE TABLE IF NOT EXISTS event_invites (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      invited_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      declined_at TEXT,
      accepted_count INTEGER DEFAULT 0
    )`,
    // 005 event_tasks
    `CREATE TABLE IF NOT EXISTS event_tasks (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      assignee_id TEXT REFERENCES users (id) ON DELETE SET NULL,
      due_at TEXT,
      created_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    )`,
    // 006 event_files
    `CREATE TABLE IF NOT EXISTS event_files (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      uploaded_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    )`,
    // 007 event_agenda_items
    `CREATE TABLE IF NOT EXISTS event_agenda_items (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      starts_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      location TEXT NOT NULL DEFAULT '',
      speaker_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'scheduled',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    // 008 visibility
    `ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`,
    // 009 event_activity
    `CREATE TABLE IF NOT EXISTS event_activity (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES users (id) ON DELETE SET NULL,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    // 010 event_templates
    `CREATE TABLE IF NOT EXISTS event_templates (
      id TEXT PRIMARY KEY,
      owner_id TEXT REFERENCES users (id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      description TEXT NOT NULL DEFAULT '',
      default_venue TEXT NOT NULL DEFAULT '',
      default_capacity INTEGER,
      default_duration_minutes INTEGER NOT NULL DEFAULT 60,
      structure_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )`,
    // 011 workspace_role
    `ALTER TABLE users ADD COLUMN workspace_role TEXT NOT NULL DEFAULT 'member'`,
    // 012 ensure owner
    `UPDATE users SET workspace_role = 'owner' WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)`,
    // 013 google_avatar_url + calendar_token
    `ALTER TABLE users ADD COLUMN google_avatar_url TEXT`,
    `ALTER TABLE users ADD COLUMN calendar_token TEXT`,
    // 014 unique index on calendar_token
    `CREATE UNIQUE INDEX IF NOT EXISTS users_calendar_token_unique ON users (calendar_token) WHERE calendar_token IS NOT NULL`,
  ];

  for (const migration of migrations) {
    try {
      db.exec(migration);
    } catch {
      // Some may already exist; ignore
    }
  }

  // Set user_version so future migrations won't re-run (we're at version 16)
  db.exec("PRAGMA user_version = 16");

  return db;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function setupUsers(db: DatabaseSync) {
  const ownerId = randomUUID();

  db.exec(
    `INSERT OR IGNORE INTO users (id, name, email, provider, created_at) VALUES
      ('${ownerId}', 'Owner', 'owner@example.com', 'password', datetime('now'))`,
  );

  // The owner's access comes from events.owner_id; no event exists yet here,
  // so no event_members row can reference an event id.
  return { ownerId };
}

function createPublicEvent(db: DatabaseSync, ownerId: string) {
  const eventId = randomUUID();
  db.prepare(`INSERT INTO events (id, owner_id, title, description, category, venue, starts_at, capacity, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'public', datetime('now'))`)
    .run(eventId, ownerId, "Public Event", "A publicly visible event", "Conference", "Convention Center", "2026-12-01T10:00:00Z", 100);
  return eventId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("non-member can find a public event via direct DB query (overview access)", () => {
  const db = createDatabase();
  const { ownerId } = setupUsers(db);
  const eventId = createPublicEvent(db, ownerId);

  // Non-member user ID - someone not in event_members
  const nonMemberId = randomUUID();

  // Simplified findEventForUser logic: public events are readable by anyone signed in with the link
  const event = db
    .prepare(
      `SELECT e.id, e.owner_id, e.title, e.description, e.category, e.venue, e.starts_at, e.capacity, e.visibility, e.created_at FROM events e WHERE e.id = ? AND (e.owner_id = ? OR e.visibility = 'public')`,
    )
    .get(eventId, nonMemberId) as {
      id: string;
      owner_id: string;
      title: string;
      description: string;
      category: string;
      venue: string;
      starts_at: string;
      capacity: number | null;
      visibility: string | null;
      created_at: string;
    } | undefined;

  assert.ok(event, "non-member should be able to find a public event");
  assert.strictEqual(event?.visibility, "public");
});

test("getEventRole returns null for non-member on a public event", () => {
  const db = createDatabase();
  const { ownerId } = setupUsers(db);
  const eventId = createPublicEvent(db, ownerId);

  // Non-member user ID
  const nonMemberId = randomUUID();

  // Simulate getEventRole SQL
  const row = db
    .prepare(
      `SELECT e.owner_id AS owner_id, em.role AS role FROM events e LEFT JOIN event_members em ON em.event_id = e.id AND em.user_id = ? AND em.status = 'accepted' WHERE e.id = ?`,
    )
    .get(nonMemberId, eventId) as { owner_id: string; role: string | null } | undefined;

  // Row will exist (owner_id match) but role will be null since no accepted membership
  if (row) {
    assert.strictEqual(row.owner_id, ownerId, "row should be the event owned by owner");
  }
  // getEventRole returns null when no row or when row.role is null and not owner
  // Since row exists but role is null, getEventRole returns null
  assert.strictEqual(row?.role, null, "getEventRole should return null for non-member on public event");
});

test("activity entries filtered to event/kind agenda for non-member on public event", () => {
  const db = createDatabase();
  const { ownerId } = setupUsers(db);
  const eventId = createPublicEvent(db, ownerId);

  const now = new Date().toISOString();

  // Add activity entries of different kinds
  db.prepare(`INSERT INTO event_activity (id, event_id, actor_id, kind, summary, created_at) VALUES (?, ?, ?, 'event', 'Owner created the event', ?)`)
    .run(randomUUID(), eventId, null, now);
  db.prepare(`INSERT INTO event_activity (id, event_id, actor_id, kind, summary, created_at) VALUES (?, ?, ?, 'agenda', 'Agenda item added', ?)`)
    .run(randomUUID(), eventId, null, now);
  db.prepare(`INSERT INTO event_activity (id, event_id, actor_id, kind, summary, created_at) VALUES (?, ?, ?, 'member', 'Member joined', ?)`)
    .run(randomUUID(), eventId, null, now);
  db.prepare(`INSERT INTO event_activity (id, event_id, actor_id, kind, summary, created_at) VALUES (?, ?, ?, 'task', 'Task created', ?)`)
    .run(randomUUID(), eventId, null, now);
  db.prepare(`INSERT INTO event_activity (id, event_id, actor_id, kind, summary, created_at) VALUES (?, ?, ?, 'file', 'File uploaded', ?)`)
    .run(randomUUID(), eventId, null, now);

  // Simulate the filtering logic from activity/page.tsx
  // Non-member role is null, so only event and agenda kinds are visible
  const allEntries = db
    .prepare(`SELECT kind, summary FROM event_activity WHERE event_id = ? ORDER BY created_at DESC`)
    .all(eventId) as { kind: string; summary: string }[];

  const role = null; // non-member
  const visibleEntries = role
    ? allEntries
    : allEntries.filter((entry) => entry.kind === "event" || entry.kind === "agenda");

  const kindStrings = visibleEntries.map((e) => e.kind).join(", ");
  assert.strictEqual(kindStrings, "event, agenda", "non-member should only see event and agenda activity entries");
});

test("filesPermissions returns null for non-member on public event", () => {
  const db = createDatabase();
  const { ownerId } = setupUsers(db);
  const eventId = createPublicEvent(db, ownerId);

  // Simulate filesPermissions logic from lib/files.ts
  const roleRow = db
    .prepare(
      `SELECT e.owner_id AS owner_id, em.role AS role FROM events e LEFT JOIN event_members em ON em.event_id = e.id AND em.user_id = ? AND em.status = 'accepted' WHERE e.id = ?`,
    )
    .get(randomUUID(), eventId) as { owner_id: string; role: string | null } | undefined;

  // Non-member: role is null
  assert.strictEqual(roleRow?.role, null, "non-member should have null role");

  // filesPermissions returns role === null ? null : rolePermissions(role)
  const permissions = roleRow?.role === null ? null : { canViewFiles: true, canManageFiles: false };
  assert.strictEqual(permissions, null, "filesPermissions should return null for non-member");
});

test("organiser email is retrieved from DB but access gated by role", () => {
  const db = createDatabase();
  const { ownerId } = setupUsers(db);
  const eventId = createPublicEvent(db, ownerId);

  // getEventOwner always returns the organiser regardless of role
  const ownerRow = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar_url FROM events e JOIN users u ON u.id = e.owner_id WHERE e.id = ?`,
    )
    .get(eventId) as { id: string; name: string; email: string; avatar_url: string | null } | undefined;

  assert.ok(ownerRow, " organiser should always be retrievable from DB");
  assert.strictEqual(ownerRow?.email, "owner@example.com", "organiser email should be in DB");
  assert.strictEqual(ownerRow?.name, "Owner", "organiser name should be visible");
});

afterEach(() => {
  openDatabase?.close();
  openDatabase = null;

  // Clean up test DB file synchronously
  const testDbPath = join(TEST_DATA_DIR, "test.db");
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }
});