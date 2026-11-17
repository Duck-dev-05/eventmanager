import { getDb } from "./db.ts";
import { listTemplatesForUser } from "./templates.ts";

export type EventSearchResult = {
  id: string;
  title: string;
  category: string;
  venue: string;
  startsAt: string;
};

export type TaskSearchResult = {
  id: string;
  title: string;
  notes: string;
  status: string;
  eventId: string;
  eventTitle: string;
  dueAt: string | null;
};

export type TemplateSearchResult = {
  id: string;
  name: string;
  category: string;
  description: string;
  agendaCount: number;
  taskCount: number;
  isCustom: boolean;
};

export type MemberSearchResult = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  eventId: string;
  eventTitle: string;
};

export type FileSearchResult = {
  id: string;
  name: string;
  sizeBytes: number;
  eventId: string;
  eventTitle: string;
};

export type WorkspaceSearchResults = {
  query: string;
  events: EventSearchResult[];
  tasks: TaskSearchResult[];
  templates: TemplateSearchResult[];
  members: MemberSearchResult[];
  files: FileSearchResult[];
};

export async function searchWorkspace({
  userId,
  query,
}: {
  userId: string;
  query: string;
}): Promise<WorkspaceSearchResults> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return {
      query: "",
      events: [],
      tasks: [],
      templates: [],
      members: [],
      files: [],
    };
  }

  const pattern = `%${cleanQuery}%`;
  const db = await getDb();

  // Search events user owns or is a member of
  const eventRows = await db
    .prepare(
      `SELECT e.id, e.title, e.category, e.venue, e.starts_at
       FROM events e
       WHERE (
         e.owner_id = ?
         OR EXISTS (
           SELECT 1 FROM event_members em
           WHERE em.event_id = e.id AND em.user_id = ? AND em.status = 'accepted'
         )
       )
       AND (e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ? OR e.category LIKE ?)
       ORDER BY e.starts_at DESC
       LIMIT 20`,
    )
    .all(userId, userId, pattern, pattern, pattern, pattern) as Array<{
    id: string;
    title: string;
    category: string;
    venue: string;
    starts_at: string;
  }>;

  const events: EventSearchResult[] = eventRows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    venue: row.venue,
    startsAt: row.starts_at,
  }));

  // Search tasks within events user has access to
  const taskRows = await db
    .prepare(
      `SELECT t.id, t.title, t.notes, t.status, t.due_at, e.id AS event_id, e.title AS event_title
       FROM event_tasks t
       JOIN events e ON e.id = t.event_id
       WHERE (
         e.owner_id = ?
         OR EXISTS (
           SELECT 1 FROM event_members em
           WHERE em.event_id = e.id AND em.user_id = ? AND em.status = 'accepted'
         )
       )
       AND (t.title LIKE ? OR t.notes LIKE ?)
       ORDER BY t.created_at DESC
       LIMIT 20`,
    )
    .all(userId, userId, pattern, pattern) as Array<{
    id: string;
    title: string;
    notes: string;
    status: string;
    due_at: string | null;
    event_id: string;
    event_title: string;
  }>;

  const tasks: TaskSearchResult[] = taskRows.map((row) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    eventId: row.event_id,
    eventTitle: row.event_title,
    dueAt: row.due_at,
  }));

  // Templates are few, so filter the merged custom + built-in list in memory.
  const needle = cleanQuery.toLowerCase();
  const templates: TemplateSearchResult[] = (await listTemplatesForUser(userId))
    .filter((template) =>
      [template.name, template.category, template.description].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    )
    .slice(0, 20)
    .map((template) => ({
      id: template.id,
      name: template.name,
      category: template.category,
      description: template.description,
      agendaCount: template.agendaPresets.length,
      taskCount: template.taskPresets.length,
      isCustom: template.isCustom === true,
    }));

  // People on any event the caller can open, plus owners, one row per event.
  const memberRows = await db
    .prepare(
      `SELECT em.event_id, e.title AS event_title, u.id, u.name, u.email,
              u.avatar_url, em.role
       FROM event_members em
       JOIN users u ON u.id = em.user_id
       JOIN events e ON e.id = em.event_id
       WHERE em.status = 'accepted'
         AND (u.name LIKE ? OR u.email LIKE ?)
         AND (e.owner_id = ? OR EXISTS (
           SELECT 1 FROM event_members me
           WHERE me.event_id = e.id AND me.user_id = ? AND me.status = 'accepted'
         ))
       UNION
       SELECT e.id, e.title, u.id, u.name, u.email, u.avatar_url, 'owner'
       FROM events e
       JOIN users u ON u.id = e.owner_id
       WHERE (u.name LIKE ? OR u.email LIKE ?)
         AND (e.owner_id = ? OR EXISTS (
           SELECT 1 FROM event_members me
           WHERE me.event_id = e.id AND me.user_id = ? AND me.status = 'accepted'
         ))
       ORDER BY name COLLATE NOCASE ASC
       LIMIT 20`,
    )
    .all(
      pattern,
      pattern,
      userId,
      userId,
      pattern,
      pattern,
      userId,
      userId,
    ) as Array<{
    event_id: string;
    event_title: string;
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: string;
  }>;

  const members: MemberSearchResult[] = memberRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url ?? undefined,
    role: row.role,
    eventId: row.event_id,
    eventTitle: row.event_title,
  }));

  const fileRows = await db
    .prepare(
      `SELECT f.id, f.name, f.size_bytes, e.id AS event_id, e.title AS event_title
       FROM event_files f
       JOIN events e ON e.id = f.event_id
       WHERE f.name LIKE ?
         AND (e.owner_id = ? OR EXISTS (
           SELECT 1 FROM event_members me
           WHERE me.event_id = e.id AND me.user_id = ? AND me.status = 'accepted'
         ))
       ORDER BY f.created_at DESC
       LIMIT 20`,
    )
    .all(pattern, userId, userId) as Array<{
    id: string;
    name: string;
    size_bytes: number;
    event_id: string;
    event_title: string;
  }>;

  const files: FileSearchResult[] = fileRows.map((row) => ({
    id: row.id,
    name: row.name,
    sizeBytes: Number(row.size_bytes) || 0,
    eventId: row.event_id,
    eventTitle: row.event_title,
  }));

  return {
    query: cleanQuery,
    events,
    tasks,
    templates,
    members,
    files,
  };
}
