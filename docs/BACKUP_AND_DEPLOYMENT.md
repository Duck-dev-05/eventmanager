# Data, backups and deployment

## Where the data lives

| What | Production (Vercel) | Local development | Override |
| --- | --- | --- | --- |
| Database | Hosted libSQL / Turso | `data/eventpulse.db` (SQLite file) | `LIBSQL_URL` |
| Uploaded event files | Vercel Blob | `data/storage/` | `BLOB_READ_WRITE_TOKEN` |
| Email + OAuth secrets | Vercel environment variables | `.env.local` (never committed) | — |

Both services keep the same SQL and API surface:

- `LIBSQL_URL` accepts a `libsql://…` hosted database (with `LIBSQL_AUTH_TOKEN`)
  or a `file:` URL. Unset, the app uses a local SQLite file — development and
  tests need no cloud account.
- Without `BLOB_READ_WRITE_TOKEN`, uploaded files and avatars fall back to
  `data/storage/` on disk.

The database file runs in WAL mode locally, so `eventpulse.db-wal` and
`eventpulse.db-shm` appear next to it while the app is running. Do not copy only
the `.db` file by hand — use the backup script.

## Deploying to Vercel

1. Create a hosted database on [Turso](https://turso.tech) (libSQL, drop-in
   compatible) and note the URL and token.
2. Enable Vercel Blob on the project (Storage tab) so `BLOB_READ_WRITE_TOKEN`
   is injected.
3. Set the environment variables in the Vercel project:
   - `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`
   - `AUTH_SECRET`
   - `APP_URL` (the deployment origin, used in emails and OAuth redirects)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional; enables “Continue
     with Google”. Add `https://<deployment>/api/v1/auth/google/callback` to the
     OAuth client's authorized redirect URIs.)
   - `GMAIL_USER` / `GMAIL_APP_PASSWORD` / optional `GMAIL_FROM`
4. Deploy. Schema migrations run automatically on first database use.

## Scheduled emails

`npm run notify` sends reminders and the weekly digest. Run it from any machine
or CI job that has the same environment variables (`LIBSQL_URL`,
`LIBSQL_AUTH_TOKEN`, `APP_URL`, `GMAIL_*`), e.g. a scheduled GitHub Action or
cron job. It never emails the same person twice for the same event and day.

## Backups

```bash
npm run backup
```

Exports every table into `backups/<timestamp>/eventpulse-dump.json`. Works
against both the local file database and the hosted database (set
`LIBSQL_URL`/`LIBSQL_AUTH_TOKEN` in the shell that runs it). Uploaded files live
in Vercel Blob in production and are not part of the dump. `backups/` is
git-ignored.

Run this on a schedule in production, and copy finished snapshots somewhere the
database provider cannot lose them.

## Restore

```bash
npm run restore -- backups/<timestamp> --yes
```

Rebuilds the schema from the app's migrations and reinserts every row from the
dump. **This replaces everything currently in the target database** — check
`LIBSQL_URL` before running. It refuses to run without `--yes`.
