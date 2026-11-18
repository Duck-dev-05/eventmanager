import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Throwaway database directory so the real one is untouched. Must be set
// before lib/db.ts is imported.
const TEST_DATA_DIR = join(tmpdir(), `eventmanager-sync-test-${process.pid}`);
rmSync(TEST_DATA_DIR, { recursive: true, force: true });
mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.DATA_DIR = TEST_DATA_DIR;

const { getDb } = await import("../lib/db.ts");
const {
  appendSyncChange,
  authenticateSyncRequest,
  createSyncDevice,
  deleteSyncDevice,
  listSyncDevices,
  pullSyncChanges,
  pushSyncChanges,
} = await import("../lib/sync.ts");

const USER_ID = "sync-test-user-0001";

async function seedUser() {
  const db = await getDb();
  await db
    .prepare(
      `INSERT OR IGNORE INTO users (id, name, email, provider, workspace_role, created_at)
       VALUES (?, 'Sync Test', 'sync-test@example.com', 'password', 'member', ?)`,
    )
    .run(USER_ID, new Date().toISOString());
}

async function insertEvent(id: string, title: string) {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO events (id, owner_id, title, description, category, venue, starts_at, capacity, visibility, created_at)
       VALUES (?, ?, ?, '', 'Other', '', '2026-06-01T10:00:00.000Z', 50, 'private', ?)`,
    )
    .run(id, USER_ID, title, new Date().toISOString());
}

function bearerRequest(token: string) {
  return new Request("https://example.com/api/sync/pull", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

test("pairing creates a device and authenticates its bearer token", async () => {
  await seedUser();

  const device = await createSyncDevice(USER_ID, "Smoke test");
  assert.match(device.token, /^epds_[0-9a-f]{48}$/);

  const devices = await listSyncDevices(USER_ID);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, "Smoke test");

  const authenticated = await authenticateSyncRequest(bearerRequest(device.token));
  assert.ok(authenticated);
  assert.equal(authenticated.userId, USER_ID);

  // A tampered or missing token must not authenticate.
  assert.equal(await authenticateSyncRequest(bearerRequest(`epds_${"0".repeat(48)}`)), null);
  assert.equal(
    await authenticateSyncRequest(
      new Request("https://example.com", { method: "POST" }),
    ),
    null,
  );

  // Revoking the device invalidates its token.
  await deleteSyncDevice(USER_ID, device.id);
  assert.equal(await authenticateSyncRequest(bearerRequest(device.token)), null);
});

test("first pull returns a snapshot of the paired user's events", async () => {
  await seedUser();
  await insertEvent("evt-snapshot-1", "Snapshot Event");

  const device = await createSyncDevice(USER_ID, "Desktop");
  const result = await pullSyncChanges(device, 0);

  assert.equal(result.mode, "snapshot");
  const events = result.events as Array<{ id: string; title: string }>;
  assert.ok(events.some((event) => event.id === "evt-snapshot-1"));
  assert.ok(result.cursor > 0);
});

test("web-origin changes are delivered incrementally to the device", async () => {
  const device = await createSyncDevice(USER_ID, "Desktop 2");

  // Bootstrap first so we have a cursor.
  const initial = await pullSyncChanges(device, 0);
  assert.equal(initial.mode, "snapshot");

  // A change made in the web app (deviceId null) ...
  await insertEvent("evt-web-new", "From The Web");
  const db = await getDb();
  await appendSyncChange(db, {
    userId: USER_ID,
    action: "upsert",
    eventId: "evt-web-new",
    event: { id: "evt-web-new", title: "From The Web" },
  });
  await appendSyncChange(db, {
    userId: USER_ID,
    action: "delete",
    eventId: "evt-web-new",
  });

  const pull = await pullSyncChanges(device, initial.cursor);
  assert.equal(pull.mode, "changes");
  const actions = pull.changes.map((change) => change.action);
  assert.ok(actions.includes("upsert"));
  assert.ok(actions.includes("delete"));
  assert.ok(pull.cursor >= initial.cursor);

  // After advancing to the returned cursor, nothing new is returned. The
  // device's own pushes must never echo back to it either.
  const echo = await pullSyncChanges(device, pull.cursor);
  assert.equal(echo.mode, "changes");
  assert.equal(echo.changes.length, 0);
});

test("pushed desktop changes land in the events table and changelog", async () => {
  const desktop = await createSyncDevice(USER_ID, "Desktop 3");
  const other = await createSyncDevice(USER_ID, "Desktop 4");

  const bootstrap = await pullSyncChanges(other, 0);

  const pushed = await pushSyncChanges(desktop, [
    {
      id: randomUUID(),
      action: "upsert",
      event: {
        id: "evt-desktop-1",
        title: "Created On Desktop",
        description: "Synced both ways",
        category: "Meetup",
        venue: "Community Hall",
        startsAt: "2026-07-04T18:00:00.000Z",
        capacity: 80,
        visibility: "public",
        createdAt: new Date().toISOString(),
      },
    },
  ]);
  assert.equal(pushed.accepted, 1);

  const db = await getDb();
  const row = (await db
    .prepare(
      "SELECT owner_id, title, capacity, visibility FROM events WHERE id = 'evt-desktop-1'",
    )
    .get()) as { owner_id: string; title: string; capacity: number; visibility: string } | undefined;

  assert.ok(row, "pushed event should be stored");
  assert.equal(row.owner_id, USER_ID, "event is owned by the paired account");
  assert.equal(row.visibility, "public");

  // Another device must receive the pushed change.
  const pull = await pullSyncChanges(other, bootstrap.cursor);
  assert.equal(pull.mode, "changes");
  const change = pull.changes.find(
    (item) => (item.event as { id?: string } | null)?.id === "evt-desktop-1",
  );
  assert.ok(change, "other devices pull the desktop change");
  assert.equal(change?.action, "upsert");
});

test("pushed deletes remove the event", async () => {
  const desktop = await createSyncDevice(USER_ID, "Desktop 5");
  await insertEvent("evt-to-delete", "Doomed Event");

  const pushed = await pushSyncChanges(desktop, [
    { id: randomUUID(), action: "delete", event: { id: "evt-to-delete" } },
  ]);
  assert.equal(pushed.accepted, 1);

  const db = await getDb();
  const row = await db.prepare("SELECT id FROM events WHERE id = 'evt-to-delete'").get();
  assert.equal(row, undefined);
});

test("invalid pushes are rejected without crashing the batch", async () => {
  const device = await createSyncDevice(USER_ID, "Desktop 6");

  const pushed = await pushSyncChanges(device, [
    { id: randomUUID(), action: "upsert", event: null },
    { id: randomUUID(), action: "upsert", event: { id: "evt-bad", title: "" } },
    { id: randomUUID(), action: "delete", event: null },
    {
      id: randomUUID(),
      action: "upsert",
      event: { id: "evt-good", title: "Valid Event", startsAt: "2026-08-01T09:00:00.000Z" },
    },
  ]);
  assert.equal(pushed.accepted, 1);

  const db = await getDb();
  const row = await db.prepare("SELECT title FROM events WHERE id = 'evt-good'").get() as
    | { title: string }
    | undefined;
  assert.equal(row?.title, "Valid Event");
});
