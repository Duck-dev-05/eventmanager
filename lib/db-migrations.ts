/**
 * Ordered schema migrations. Shared by lib/db.ts (app) and the backup/restore
 * scripts, which import it directly under Node's native TypeScript stripping.
 */
export const migrations: string[] = [
  `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'password',
      password_hash TEXT,
      google_sub TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX users_google_sub_unique
      ON users (google_sub)
      WHERE google_sub IS NOT NULL;
  `,
  `
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Other',
      venue TEXT NOT NULL DEFAULT '',
      starts_at TEXT NOT NULL,
      capacity INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE INDEX events_owner_starts_idx
      ON events (owner_id, starts_at);
  `,
  `
    CREATE TABLE event_members (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      invited_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending',
      UNIQUE (event_id, user_id)
    );
  `,
  `
    CREATE TABLE user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
      event_reminders INTEGER NOT NULL DEFAULT 1,
      email_updates INTEGER NOT NULL DEFAULT 1,
      weekly_digest INTEGER NOT NULL DEFAULT 0,
      default_capacity INTEGER,
      updated_at TEXT NOT NULL
    );
  `,
  `
    ALTER TABLE event_members ADD COLUMN invite_token TEXT;
    ALTER TABLE event_members ADD COLUMN invite_expires_at TEXT;
    CREATE UNIQUE INDEX event_members_invite_token_unique
      ON event_members (invite_token)
      WHERE invite_token IS NOT NULL;
  `,
  `
    CREATE TABLE event_invites (
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
    );

    CREATE UNIQUE INDEX event_invites_pending_email_unique
      ON event_invites (event_id, email)
      WHERE status = 'pending';

    INSERT OR IGNORE INTO event_invites
      (id, event_id, email, invited_by, token, status, expires_at, created_at)
    SELECT em.id, em.event_id, u.email, em.invited_by, em.invite_token,
           'pending', em.invite_expires_at, em.invited_at
    FROM event_members em
    JOIN users u ON u.id = em.user_id
    WHERE em.status = 'pending' AND em.invite_token IS NOT NULL;

    DELETE FROM event_members
    WHERE status = 'pending' AND invite_token IS NOT NULL;
  `,
  `
    CREATE TABLE event_tasks (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      assignee_id TEXT REFERENCES users (id) ON DELETE SET NULL,
      due_at TEXT,
      created_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE INDEX event_tasks_event_created_idx
      ON event_tasks (event_id, created_at);
  `,
  `
    ALTER TABLE event_invites ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
  `,
  `
    CREATE TABLE event_files (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      uploaded_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE INDEX event_files_event_created_idx
      ON event_files (event_id, created_at);
  `,
  `
    CREATE TABLE event_agenda_items (
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
    );

    CREATE INDEX event_agenda_event_idx
      ON event_agenda_items (event_id, starts_at);
  `,
  `
    CREATE TABLE event_templates (
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
    );

    CREATE INDEX event_templates_owner_idx
      ON event_templates (owner_id, created_at);
  `,
  `
    CREATE TABLE password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX password_resets_token_idx
      ON password_resets (token);
  `,
  `
    CREATE TABLE event_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      event_id TEXT REFERENCES events (id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      link_url TEXT NOT NULL DEFAULT '',
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX event_notifications_user_created_idx
      ON event_notifications (user_id, created_at);

    CREATE INDEX event_notifications_unread_idx
      ON event_notifications (user_id)
      WHERE read_at IS NULL;
  `,
  `
    ALTER TABLE users ADD COLUMN workspace_role TEXT NOT NULL DEFAULT 'member';

    UPDATE users SET workspace_role = 'owner'
    WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);
  `,
  `
    ALTER TABLE users ADD COLUMN google_avatar_url TEXT;
    ALTER TABLE users ADD COLUMN calendar_token TEXT;

    CREATE UNIQUE INDEX users_calendar_token_unique
      ON users (calendar_token)
      WHERE calendar_token IS NOT NULL;

    CREATE TABLE event_activity (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES users (id) ON DELETE SET NULL,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX event_activity_event_created_idx
      ON event_activity (event_id, created_at);

    CREATE TABLE sent_email_log (
      key TEXT PRIMARY KEY,
      sent_at TEXT NOT NULL
    );
  `,
  `
    ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
  `,
  `
    -- Desktop app sync: paired devices and an ordered changelog of event
    -- mutations. Desktop apps poll /api/sync/pull and push via /api/sync/push.
    CREATE TABLE sync_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Desktop app',
      token_hash TEXT NOT NULL UNIQUE,
      last_seen_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX sync_devices_user_idx
      ON sync_devices (user_id);

    CREATE TABLE sync_changes (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      device_id TEXT REFERENCES sync_devices (id) ON DELETE SET NULL,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX sync_changes_user_seq_idx
      ON sync_changes (user_id, seq);

    CREATE TABLE sync_acks (
      device_id TEXT PRIMARY KEY REFERENCES sync_devices (id) ON DELETE CASCADE,
      last_seq INTEGER NOT NULL DEFAULT 0
    );
  `,
  `
    ALTER TABLE event_tasks ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
    UPDATE event_tasks SET updated_at = created_at WHERE updated_at = '';

    ALTER TABLE event_agenda_items ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
    UPDATE event_agenda_items SET updated_at = created_at WHERE updated_at = '';

    ALTER TABLE event_files ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
    UPDATE event_files SET updated_at = created_at WHERE updated_at = '';

    CREATE TABLE sync_file_upload_chunks (
      device_id TEXT NOT NULL REFERENCES sync_devices (id) ON DELETE CASCADE,
      file_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL,
      bytes BLOB NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (device_id, file_id, chunk_index)
    );
    CREATE INDEX sync_file_upload_chunks_created_idx
      ON sync_file_upload_chunks (created_at);

    CREATE TABLE sync_work_tombstones (
      event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('task', 'agenda', 'file')),
      entity_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (event_id, kind, entity_id)
    );
    CREATE INDEX sync_work_tombstones_deleted_idx
      ON sync_work_tombstones (deleted_at);
  `,
  `
    CREATE TABLE mobile_google_pairing_sessions (
      id TEXT PRIMARY KEY,
      poll_secret_hash TEXT NOT NULL,
      launch_code_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'complete')),
      device_id TEXT REFERENCES sync_devices (id) ON DELETE CASCADE,
      device_token TEXT,
      user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
      user_name TEXT,
      user_email TEXT,
      user_role TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX mobile_google_pairing_expires_idx
      ON mobile_google_pairing_sessions (expires_at);
  `,
];
