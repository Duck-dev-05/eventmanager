# EventPulse

A small event workspace: create events, invite a team, plan the agenda, assign
checklist work, share files, track activity, and keep everything in sync with
email reminders and calendar feeds.

Built with Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, and
`node:sqlite` on the filesystem. No external database or hosted service is
required beyond Gmail (optional) and Google OAuth (optional).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open <http://localhost:3000>. The first account that signs up becomes the
workspace **owner**; everyone after joins as a member until the owner promotes
them under **Users**.

### Environment

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `AUTH_SECRET` | production | Signs session cookies. The app refuses to start in production without it, and falls back to a development secret locally. |
| `APP_URL` | for email/calendar | Public origin used in invitation emails and calendar feed URLs (`http://localhost:3000` is fine locally). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables “Continue with Google”. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | optional | Sends invitations, password resets, task assignments and reminders. Use a Google App Password, never the account password. |
| `GMAIL_FROM` | optional | Display address for outgoing mail; defaults to `GMAIL_USER`. |
| `DATA_DIR` | optional | Moves the SQLite file, uploads and avatars outside `./data` (e.g. a mounted volume). |

Without Gmail credentials the app still works: invitations return a copyable
link and the reminder job logs that email is not configured.

## What is in the app

- **Events** — create, edit, delete, capacity, venue, category, print view,
  per-event ICS download and a personal calendar feed.
- **Team** — invitations by link/email with pending, accept, decline and resend;
  owner/admin/member/viewer roles enforced server-side.
- **Agenda** — sessions with times, durations, speakers and status transitions.
- **Tasks** — assignment, due dates, completion tracking, email assignment
  notices, per-event activity feed.
- **Files** — 20 MB uploads with type-aware previews, downloads and access
  checks.
- **Templates** — built-in presets plus your own, able to seed a new event's
  agenda and checklist.
- **Workspace** — dashboard, global search (events, tasks, templates, people,
  files), notifications with read state, user administration for owners.
- **Account** — profile, uploaded or Google avatar, preferences, password reset.

## Scripts

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Development server (Turbopack). |
| `npm run build` / `npm start` | Production build and server. |
| `npm run lint` | ESLint over the project. |
| `npm test` | Node test runner for permissions, sessions, avatars and rate limiting. |
| `npm run backup` | Consistent snapshot of the database and uploads into `backups/<timestamp>/`. |
| `npm run restore -- <dir> --yes` | Restores a snapshot over the live data. |
| `npm run notify` | Sends due reminders and weekly digests; add `-- --dry-run` to preview. |

## Data and deployment

All state lives on the filesystem:

- `data/eventpulse.db` (SQLite, WAL mode)
- `data/uploads/<eventId>/`
- `data/avatars/`

That means the app needs a persistent host (a VPS, a container with a volume, or
a local machine). It cannot run on an ephemeral/serverless filesystem such as
Vercel without moving storage to a hosted database and object store. Point
`DATA_DIR` at a mounted volume to keep everything together.

Schema migrations run automatically when the database connection opens. After
pulling a release with new migrations, restart the server; a long-running
development process keeps its original connection and schema.

## Operations

- [Backup and deployment notes](docs/BACKUP_AND_DEPLOYMENT.md)
- [Notifications and calendar feeds](docs/NOTIFICATIONS_AND_CALENDAR.md)
- [Project audit](docs/PROJECT_AUDIT.md)

## Checks

CI (`.github/workflows/ci.yml`) runs `next typegen`, `tsc --noEmit`,
`npm run lint` and `npm test` on every push and pull request. Locally:

```bash
npx next typegen && npx tsc --noEmit && npm run lint && npm test
```
