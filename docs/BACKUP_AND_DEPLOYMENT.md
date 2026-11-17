# Data, backups and deployment

## Where the data lives

| What | Default location | Override |
| --- | --- | --- |
| SQLite database | `data/eventpulse.db` | `DATA_DIR` |
| Uploaded event files | `data/uploads/<eventId>/` | `DATA_DIR` |
| Email + OAuth secrets | `.env.local` (never committed) | — |

`DATA_DIR` moves **both** the database and uploads, so pointing it at a mounted
volume is enough to keep everything together. It accepts an absolute path.

The SQLite file runs in WAL mode, so `eventpulse.db-wal` and `eventpulse.db-shm`
appear next to it while the app is running. Do not copy only the `.db` file by
hand — use the backup script, which produces a consistent snapshot.

## Backups

```bash
npm run backup
```

Creates `backups/<timestamp>/eventpulse.db` (written with `VACUUM INTO`, safe to
run while the app is up) plus `backups/uploads/` when files exist. `backups/` is
git-ignored.

Run this before migrations, before inviting a large group, and on a schedule in
production (cron / Task Scheduler). Copy finished snapshots off the disk that
hosts the database; a backup on the same disk does not survive disk failure.

## Restore

Stop the app first, then:

```bash
npm run restore -- backups/<timestamp> --yes
```

The script replaces `data/eventpulse.db`, clears stale `-wal`/`-shm` files and
copies the snapshot's uploads back. It refuses to run without `--yes` because it
overwrites live data.

## Hosting constraint

This app keeps its state on the filesystem. That means:

- It needs a host with a **persistent disk** (a VPS, a container with a volume,
  or a managed host that provides one). Serverless platforms with ephemeral
  filesystems will lose events, uploads and accounts on every deploy.
- Run **one instance**. SQLite allows many readers but a single writer; two app
  processes sharing a database file across machines is not supported.
- The in-process rate limiter in `lib/rate-limit.ts` assumes a single process.
  Moving to several instances requires a shared store (Redis, database-backed
  buckets) and a hosted database/object storage.

When the app outgrows this, the migration path is: database → a hosted
SQLite-compatible service or Postgres, uploads → object storage, `lib/db.ts` and
`lib/files.ts` are the only two modules that know about the filesystem.

## Required environment

- `AUTH_SECRET` — long random value. The app refuses to sign sessions in
  production without it (`lib/session.ts`), because the development fallback is
  public in this repository.
- `APP_URL` — public origin used in invitation and password-reset links.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — optional Google sign-in.
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM` — outbound email. Without
  them, invitations and reset links are shown in the UI instead of emailed.
