import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { authenticateSyncRequest } from "@/lib/sync";
import { getEventRole } from "@/lib/events";
import { rolePermissions } from "@/lib/roles";
import { MAX_FILE_BYTES } from "@/lib/file-types";
import { logEventActivity } from "@/lib/activity";

type WorkKind = "task" | "agenda" | "file";
type WorkChange = { kind?: unknown; action?: unknown; entity?: Record<string, unknown> };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function dateText(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return new Date().toISOString();
  return new Date(value).toISOString();
}

async function userCanAccessEvent(eventId: string, userId: string) {
  const result = await (await getDb()).prepare(
    `SELECT EXISTS(
       SELECT 1 FROM events e
       WHERE e.id = ? AND (e.owner_id = ? OR EXISTS (
         SELECT 1 FROM event_members em
         WHERE em.event_id = e.id AND em.user_id = ? AND em.status = 'accepted'
       ))
     ) AS allowed`,
  ).get(eventId, userId, userId) as { allowed: number } | undefined;
  return Boolean(result?.allowed);
}

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });

  let body: { action?: unknown; changes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.action === "pull") {
    const db = await getDb();
    const access = `(e.owner_id = ? OR EXISTS (SELECT 1 FROM event_members em WHERE em.event_id=e.id AND em.user_id=? AND em.status='accepted'))`;
    const [tasks, agenda, files, tombstones] = await Promise.all([
      db.prepare(
        `SELECT t.id, t.event_id AS eventId, t.title, t.notes, t.status, t.assignee_id AS assigneeId,
                u.name AS assigneeName, t.due_at AS dueAt, t.created_at AS createdAt, t.updated_at AS updatedAt
         FROM event_tasks t JOIN events e ON e.id=t.event_id
         LEFT JOIN users u ON u.id=t.assignee_id
         WHERE ${access} ORDER BY t.updated_at`,
      ).all(device.userId, device.userId, device.userId),
      db.prepare(
        `SELECT a.id, a.event_id AS eventId, a.title, a.description, a.starts_at AS startsAt,
                a.duration_minutes AS durationMinutes, a.location, a.speaker_name AS speakerName,
                a.status, a.sort_order AS sortOrder, a.created_at AS createdAt, a.updated_at AS updatedAt
         FROM event_agenda_items a JOIN events e ON e.id=a.event_id
         WHERE ${access} ORDER BY a.starts_at, a.sort_order`,
      ).all(device.userId, device.userId, device.userId),
      db.prepare(
        `SELECT f.id, f.event_id AS eventId, f.name, f.mime_type AS mimeType,
                f.size_bytes AS sizeBytes, u.name AS uploaderName, f.uploaded_by AS uploadedBy,
                f.created_at AS createdAt, f.updated_at AS updatedAt
         FROM event_files f JOIN events e ON e.id=f.event_id
         LEFT JOIN users u ON u.id=f.uploaded_by
         WHERE ${access} ORDER BY f.created_at DESC`,
      ).all(device.userId, device.userId, device.userId),
      db.prepare(
        `SELECT t.event_id AS eventId,t.kind,t.entity_id AS entityId,t.deleted_at AS deletedAt
         FROM sync_work_tombstones t JOIN events e ON e.id=t.event_id WHERE ${access}`,
      ).all(device.userId, device.userId, device.userId),
    ]);
    return NextResponse.json({ tasks, agenda, files, tombstones, pairedUserId: device.userId });
  }

  if (body.action !== "push" || !Array.isArray(body.changes)) {
    return NextResponse.json({ error: "Choose a valid work sync action." }, { status: 400 });
  }

  const db = await getDb();
  let accepted = 0;
  for (const raw of (body.changes as WorkChange[]).slice(0, 50)) {
    if (!raw || !raw.entity || !["task", "agenda", "file"].includes(text(raw.kind))) continue;
    const kind = text(raw.kind) as WorkKind;
    const action = raw.action === "delete" ? "delete" : "upsert";
    const entity = raw.entity;
    const id = text(entity.id);
    const eventId = text(entity.eventId ?? entity.event_id);
    if (!id || !eventId || !(await userCanAccessEvent(eventId, device.userId))) continue;
    const role = await getEventRole(eventId, device.userId);
    if (!role) continue;
    const permissions = rolePermissions(role);
    const rawUpdatedAt = text(entity.updatedAt ?? entity.updated_at);
    if (!rawUpdatedAt || Number.isNaN(Date.parse(rawUpdatedAt))) continue;
    const updatedAt = dateText(rawUpdatedAt);
    const collisionTable = kind === "task" ? "event_tasks" : kind === "agenda" ? "event_agenda_items" : "event_files";
    const collision = await db.prepare(`SELECT event_id FROM ${collisionTable} WHERE id=?`).get(id) as { event_id: string } | undefined;
    if (collision && collision.event_id !== eventId) continue;
    const tombstone = await db.prepare(
      "SELECT deleted_at FROM sync_work_tombstones WHERE event_id=? AND kind=? AND entity_id=?",
    ).get(eventId, kind, id) as { deleted_at: string } | undefined;
    if (action === "upsert" && tombstone && tombstone.deleted_at >= updatedAt) {
      accepted++;
      continue;
    }
    if (action === "delete" && tombstone && tombstone.deleted_at > updatedAt) {
      accepted++;
      continue;
    }

    if (kind === "task") {
      if (action === "delete") {
        if (!permissions.canDelete) continue;
        const existing = await db.prepare("SELECT title,updated_at FROM event_tasks WHERE id=? AND event_id=?").get(id, eventId) as { title: string; updated_at: string } | undefined;
        if (!existing || existing.updated_at <= updatedAt) {
          const result = await db.prepare("DELETE FROM event_tasks WHERE id=? AND event_id=? AND updated_at<=?").run(id, eventId, updatedAt);
          await db.prepare("INSERT INTO sync_work_tombstones(event_id,kind,entity_id,deleted_at) VALUES(?,?,?,?) ON CONFLICT(event_id,kind,entity_id) DO UPDATE SET deleted_at=excluded.deleted_at").run(eventId, kind, id, updatedAt);
          if (result.changes > 0 && existing) await logEventActivity({ eventId, actorId: device.userId, kind: "task", summary: `deleted task ${existing.title}` });
        }
        accepted++;
        continue;
      }
      if (!permissions.canEdit) continue;
      const title = text(entity.title).trim();
      if (!title || title.length > 140) continue;
      const assigneeId = entity.assigneeIsPairedUser === true
        ? device.userId
        : (text(entity.assigneeId ?? entity.assignee_id) || null);
      if (assigneeId && !(await userCanAccessEvent(eventId, assigneeId))) continue;
      const previous = await db.prepare("SELECT title,notes,status,assignee_id,due_at,updated_at FROM event_tasks WHERE id=? AND event_id=?").get(id, eventId) as { title: string; notes:string; status:string; assignee_id:string|null; due_at:string|null; updated_at: string } | undefined;
      const nextNotes = text(entity.notes);
      const nextStatus = text(entity.status) === "done" ? "done" : "open";
      const rawDueAt = text(entity.dueAt ?? entity.due_at);
      if (rawDueAt && Number.isNaN(Date.parse(rawDueAt))) continue;
      const nextDueAt = rawDueAt ? dateText(rawDueAt) : null;
      const nextCreatedAt = dateText(entity.createdAt ?? entity.created_at);
      await db.prepare("DELETE FROM sync_work_tombstones WHERE event_id=? AND kind=? AND entity_id=?").run(eventId, kind, id);
      const upsert = await db.prepare(
        `INSERT INTO event_tasks
           (id,event_id,title,notes,status,assignee_id,due_at,created_by,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title,notes=excluded.notes,status=excluded.status,
           assignee_id=excluded.assignee_id,due_at=excluded.due_at,updated_at=excluded.updated_at
         WHERE event_tasks.event_id=excluded.event_id AND excluded.updated_at >= event_tasks.updated_at`,
      ).run(id, eventId, title, nextNotes, nextStatus, assigneeId, nextDueAt, device.userId, nextCreatedAt, updatedAt);
      const taskChanged = !previous || previous.title !== title || previous.notes !== nextNotes || previous.status !== nextStatus || previous.assignee_id !== assigneeId || previous.due_at !== nextDueAt;
      if (upsert.changes > 0 && taskChanged) await logEventActivity({ eventId, actorId: device.userId, kind: "task", summary: `${previous ? "updated" : "created"} task ${title}` });
      accepted++;
      continue;
    }

    if (kind === "agenda") {
      if (action === "delete") {
        if (!permissions.canDelete) continue;
        const existing = await db.prepare("SELECT title,updated_at FROM event_agenda_items WHERE id=? AND event_id=?").get(id, eventId) as { title: string; updated_at: string } | undefined;
        if (!existing || existing.updated_at <= updatedAt) {
          const result = await db.prepare("DELETE FROM event_agenda_items WHERE id=? AND event_id=? AND updated_at<=?").run(id, eventId, updatedAt);
          await db.prepare("INSERT INTO sync_work_tombstones(event_id,kind,entity_id,deleted_at) VALUES(?,?,?,?) ON CONFLICT(event_id,kind,entity_id) DO UPDATE SET deleted_at=excluded.deleted_at").run(eventId, kind, id, updatedAt);
          if (result.changes > 0 && existing) await logEventActivity({ eventId, actorId: device.userId, kind: "agenda", summary: `deleted agenda session ${existing.title}` });
        }
        accepted++;
        continue;
      }
      if (!permissions.canEdit) continue;
      const title = text(entity.title).trim();
      const startsAt = text(entity.startsAt ?? entity.starts_at);
      const startsTimestamp = Date.parse(startsAt);
      const duration = Number(entity.durationMinutes ?? entity.duration_minutes);
      if (!title || Number.isNaN(startsTimestamp) || !Number.isInteger(duration) || duration < 5 || duration > 1440) continue;
      const status = ["scheduled", "live", "completed", "cancelled"].includes(text(entity.status)) ? text(entity.status) : "scheduled";
      await db.prepare("DELETE FROM sync_work_tombstones WHERE event_id=? AND kind=? AND entity_id=?").run(eventId, kind, id);
      const previous = await db.prepare("SELECT title,description,starts_at,duration_minutes,location,speaker_name,status,sort_order,updated_at FROM event_agenda_items WHERE id=? AND event_id=?").get(id, eventId) as { title:string; description:string; starts_at:string; duration_minutes:number; location:string; speaker_name:string; status:string; sort_order:number; updated_at:string } | undefined;
      const description = text(entity.description);
      const location = text(entity.location);
      const speakerName = text(entity.speakerName ?? entity.speaker_name);
      const sortOrder = Number(entity.sortOrder ?? entity.sort_order) || 0;
      const normalizedStartsAt = new Date(startsTimestamp).toISOString();
      const agendaChanged = !previous || previous.title !== title || previous.description !== description || previous.starts_at !== normalizedStartsAt || previous.duration_minutes !== duration || previous.location !== location || previous.speaker_name !== speakerName || previous.status !== status || previous.sort_order !== sortOrder;
      const upsert = await db.prepare(
        `INSERT INTO event_agenda_items
           (id,event_id,title,description,starts_at,duration_minutes,location,speaker_name,status,sort_order,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,starts_at=excluded.starts_at,
           duration_minutes=excluded.duration_minutes,location=excluded.location,speaker_name=excluded.speaker_name,
           status=excluded.status,sort_order=excluded.sort_order,updated_at=excluded.updated_at
         WHERE event_agenda_items.event_id=excluded.event_id AND excluded.updated_at >= event_agenda_items.updated_at`,
      ).run(id, eventId, title, description, normalizedStartsAt, duration, location, speakerName, status, sortOrder, dateText(entity.createdAt ?? entity.created_at), updatedAt);
      if (upsert.changes > 0 && agendaChanged) await logEventActivity({ eventId, actorId: device.userId, kind: "agenda", summary: `${previous ? "updated" : "created"} agenda session ${title}` });
      accepted++;
      continue;
    }

    if (action === "delete") {
      if (!permissions.canDelete) continue;
      const file = await db.prepare("SELECT storage_key,name,updated_at FROM event_files WHERE id=? AND event_id=?").get(id, eventId) as { storage_key: string; name: string; updated_at: string } | undefined;
      if (!file || file.updated_at <= updatedAt) {
        if (file) await db.prepare("DELETE FROM event_files WHERE id=? AND event_id=? AND updated_at<=?").run(id, eventId, updatedAt);
        await db.prepare("INSERT INTO sync_work_tombstones(event_id,kind,entity_id,deleted_at) VALUES(?,?,?,?) ON CONFLICT(event_id,kind,entity_id) DO UPDATE SET deleted_at=excluded.deleted_at").run(eventId, kind, id, updatedAt);
        await db.prepare("DELETE FROM sync_file_upload_chunks WHERE file_id=? AND event_id=?").run(id, eventId);
        if (file) {
          await deleteObject(file.storage_key);
          await logEventActivity({ eventId, actorId: device.userId, kind: "file", summary: `deleted ${file.name}` });
        }
      }
      accepted++;
      continue;
    }

    if (!permissions.canManageFiles) continue;
    const fileName = text(entity.name).trim();
    const sizeBytes = Number(entity.sizeBytes ?? entity.size_bytes);
    if (!fileName || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) continue;
    const mimeType = text(entity.mimeType ?? entity.mime_type, "application/octet-stream");
    const uploadBytes = Boolean(entity.uploadBytes);
    const existing = await db.prepare("SELECT storage_key, updated_at, name FROM event_files WHERE id=? AND event_id=?").get(id, eventId) as { storage_key: string; updated_at: string; name: string } | undefined;
    if (existing && existing.updated_at > updatedAt) {
      if (uploadBytes && existing.storage_key.startsWith("sync-pending:")) {
        const pendingDeviceId = existing.storage_key.slice("sync-pending:".length).split(":")[0];
        const syncDevice = await db.prepare("SELECT user_id FROM sync_devices WHERE id=?").get(pendingDeviceId) as { user_id: string } | undefined;
        if (syncDevice?.user_id === device.userId) accepted++;
        else continue;
      } else {
        accepted++;
      }
      continue;
    }
    const collision = await db.prepare("SELECT event_id FROM event_files WHERE id=?").get(id) as { event_id: string } | undefined;
    if (collision && collision.event_id !== eventId) continue;
    if (uploadBytes && existing && !existing.storage_key.startsWith(`sync-pending:${device.id}:`)) {
      await db.prepare("UPDATE event_files SET storage_key=? WHERE id=? AND event_id=?").run(`sync-pending:${device.id}:${id}`, id, eventId);
    }
    const oldName = existing?.name;
    const hadNewerVersion = Boolean(existing && existing.updated_at !== updatedAt);
    await db.prepare("DELETE FROM sync_work_tombstones WHERE event_id=? AND kind=? AND entity_id=?").run(eventId, kind, id);
    if (!existing) {
      await db.prepare(
        `INSERT INTO event_files (id,event_id,name,mime_type,size_bytes,storage_key,uploaded_by,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(id, eventId, fileName.slice(0, 180), mimeType, sizeBytes, `sync-pending:${device.id}:${id}`, device.userId, dateText(entity.createdAt ?? entity.created_at), updatedAt);
    } else {
      await db.prepare(
        `UPDATE event_files SET name=?,mime_type=?,size_bytes=?,updated_at=?
         WHERE id=? AND event_id=? AND updated_at<=?`,
      ).run(fileName.slice(0, 180), mimeType, sizeBytes, updatedAt, id, eventId, updatedAt);
    }
    if (!existing || hadNewerVersion) {
      await logEventActivity({ eventId, actorId: device.userId, kind: "file", summary: `${existing ? "updated" : "uploaded"} ${fileName}` });
    } else if (existing && oldName !== fileName) {
      await logEventActivity({ eventId, actorId: device.userId, kind: "file", summary: `renamed ${oldName} to ${fileName}` });
    }
    accepted++;
    if (!uploadBytes && existing) continue;
  }

  const pendingUploads = await db.prepare(
    "SELECT id,updated_at AS updatedAt FROM event_files WHERE storage_key LIKE ?",
  ).all(`sync-pending:${device.id}:%`) as { id: string; updatedAt: string }[];
  const pendingUploadById = new Map<string, { id: string; updatedAt: string }>();
  for (const file of pendingUploads) pendingUploadById.set(file.id, file);
  const requestedFileVersions = new Map<string, string>();
  for (const change of (body.changes as WorkChange[]).slice(0, 50)) {
    if (change?.kind !== "file" || change.action === "delete" || !change.entity) continue;
    const fileId = text(change.entity.id);
    const rawTimestamp = text(change.entity.updatedAt ?? change.entity.updated_at);
    if (!fileId || Number.isNaN(Date.parse(rawTimestamp))) continue;
    if (change.entity.uploadBytes !== true) continue;
    const timestamp = dateText(rawTimestamp);
    if (timestamp > (requestedFileVersions.get(fileId) ?? "")) requestedFileVersions.set(fileId, timestamp);
  }
  return NextResponse.json({
    accepted,
    pendingUploads: [...requestedFileVersions].flatMap(([id, updatedAt]) => {
      const file = pendingUploadById.get(id);
      return file?.updatedAt === updatedAt ? [file] : [];
    }),
  });
}
