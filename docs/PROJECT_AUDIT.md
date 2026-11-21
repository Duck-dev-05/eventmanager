# EventPulse — Project Audit

**Audit date:** 14 November 2026
**Project:** EventPulse (`eventmanager`) — Next.js 16 App Router, React 19, Node `node:sqlite`, Tailwind v4, Nodemailer
**Method:** full route inventory, source reading, `npx tsc --noEmit`, `npm run lint`
**Scope:** correctness, incomplete features, missing pages, documentation drift. No code was changed during this audit.

> **Maintenance note:** This is a historical snapshot, not a current backlog. Several items below have since been implemented. Current deployment, test, and feature guidance lives in [`README.md`](../README.md) and [`docs/BACKUP_AND_DEPLOYMENT.md`](./BACKUP_AND_DEPLOYMENT.md). The previously reported P2 hygiene risks were rechecked: no `lib/db.ts.bak` exists, `*.log` is ignored, the README documents deployment/storage, tests and CI are present, `AUTH_SECRET` fails closed in production, and global not-found/error boundaries exist. Re-run the checks in section 6 before treating this audit as current.

> This file describes the code as it exists today. It supersedes the older
> [`pending-work.md`](./pending-work.md) and
> [`REQUIRED_PAGES_AND_FUNCTIONS.md`](./REQUIRED_PAGES_AND_FUNCTIONS.md) where they disagree —
> both were written before the agenda, search, print, and settings work landed and still
> describe several finished features as "next priority".

---

## Resolution log — 14 November 2026

Every P0 item in this audit is now implemented. Checks: `npx tsc --noEmit` exit 0,
`npm run lint` exit 0, `npm run build` exit 0. Migrations 11 (event_templates) and
12 (password_resets) applied cleanly against the live database (user_version 12).

Live verification performed: guest landing page renders at `/`; sign-up works; a template
was saved through the UI, listed in `/templates`, and rendered on its detail page; the
forgot-password action created a real reset token; token consumption, password write and
single-use behaviour were verified against a copy of the database. The reset form itself
was rendered but its submit was not clicked (the browser panel closed its tab mid-test).

---

## 1. At a glance

| Area | State | Evidence |
| :--- | :--- | :--- |
| Type safety | ✅ Clean | `npx tsc --noEmit` exits `0` |
| Lint | ✅ Clean | `npm run lint` exits `0` |
| Auth (email/password + Google) | ✅ Working | `lib/auth-actions.ts`, `lib/google.ts`, `proxy.ts` guard |
| Events CRUD | ✅ Working | create / read / update / delete, owner-only delete |
| Members, roles, invites, email | ✅ Working | `lib/events.ts`, `lib/member-actions.ts`, `lib/event-invite-email.ts` |
| Tasks | 🟡 Partial | create / toggle / delete only — no editing |
| Schedule / agenda | ✅ Working | `event_agenda_items` (migration 10) + `components/event-agenda-list.tsx` |
| Files | 🟡 Partial | upload / preview / download / delete — no rename, no quota |
| Templates | ✅ Persisted | Built-in presets + custom templates saved in `event_templates`; preset seeding into events still pending (see P1-1) |
| Notifications | 🟡 Derived only | computed from events, no table, no read state |
| Event activity | 🟡 Hardcoded | two fixed rows + "More activity coming soon" |
| Password recovery | ✅ Working | Single-use tokens, 60-minute expiry, Gmail delivery, both forms wired |
| Landing page | ✅ Reachable | `next.config.ts` redirect removed; guests see `app/page.tsx`, signed-in users go to `/dashboard` |
| Tests | ❌ None | no test script, no test files |

---

## 2. Verification results

### 2.1 Typecheck

```
npx tsc --noEmit   →   exit 0
```

### 2.2 ESLint (`npm run lint` → exit 1)

| File | Line | Rule | Detail |
| :--- | :--- | :--- | :--- |
| `app/(app)/dashboard/page.tsx` | 95 | `react-hooks/purity` (**error**) | `Date.now()` called during render. `now` is already computed above on line 84 — reuse it: `new Date(nextEvent.startsAt).getTime() - now`. |
| `app/(app)/events/[id]/schedule/page.tsx` | 8, 12 | `no-unused-vars` (warning) | `CalendarDotsIcon`, `TicketIcon` imported but unused |
| `components/event-agenda-list.tsx` | 3, 5 | `no-unused-vars` (warning) | `useId`, `Link` imported but unused |

---

## 3. Confirmed issues

### 3.1 P0 — broken or misleading behaviour

#### P0-1. The landing page can never render — ✅ fixed
- `next.config.ts` declares `redirects(): "/" → "/dashboard"`. Next.js applies `redirects` **before** filesystem routes, so `app/page.tsx` (a full marketing page with hero, feature grid, footer) is dead code.
- Visible effect: a signed-out visitor hitting `/` is redirected to `/dashboard` and then bounced by `proxy.ts` to `/login`. The product's only public/promotional page is unreachable, and `README.md` still tells people to open `http://localhost:3000` to "see the result".
- **Fix:** pick one owner of `/`. Either delete the `redirects()` entry and let `app/page.tsx` redirect signed-in users (it already does), or delete `app/page.tsx`. The first option keeps the landing page.

#### P0-2. Password recovery is a non-functional flow — ✅ fixed
- `app/forgot-password/page.tsx:30-33` — `<form action={async () => { "use server"; /* Handled via reset email service */ }}>`: submits, returns nothing, no email, no confirmation, no error.
- `app/reset-password/[token]/page.tsx:34-37` — same pattern; the token in the URL is never validated and no password is written.
- No `password_resets` table exists in `lib/db.ts` (migrations stop at `event_agenda_items`), and there is no `lib/password-reset.ts`.
- Login links to `/forgot-password`, so users are funneled into a dead end with no feedback.
- **Fix:** add migration 11 (`password_resets`), a token service, `sendPasswordResetEmail`, and wire both forms to real server actions with success/error states.

#### P0-3. "Save template" does nothing — ✅ fixed
- `app/(app)/templates/new/page.tsx:138-142` — the button is `type="button"` with `onClick={() => alert("Custom template creator will be linked to persistent DB storage.")}`. The form has no `action`.
- No `event_templates` table in `lib/db.ts`; `lib/templates.ts` only exports `BUILT_IN_TEMPLATES`.
- **Fix:** add migration 8, `lib/template-actions.ts` (`createTemplate`), and swap the alert for a real `useActionState` form.

#### P0-4. Lint fails the repo — ✅ fixed
The `Date.now()` purity error (see 2.2) made `npm run lint` exit non-zero, so lint could not be used as a pre-commit/CI gate. The render now reuses the existing `now` value, and the unused imports were dropped.

#### P0-5. Signed-in users could not open password recovery — ✅ fixed
`proxy.ts` treated `/forgot-password` and `/reset-password` as pages to redirect *away* from
when a session existed. A reset link opened in a browser that still had a session bounced to
`/dashboard`. Only `/login` and `/register` are redirected now; both recovery pages are public.

### 3.2 P1 — features that stop short of their own UI copy

#### P1-1. "Use template" does not seed the agenda or checklist
- `app/(app)/events/new/page.tsx` only prefills `title`, `description`, `category`, `venue`, `capacity`; `eventTemplateId` is never passed to `publishEvent`, and `publishEvent` (`lib/event-actions.ts`) never calls agenda/task creators.
- `app/(app)/templates/[id]/page.tsx` promises "automatically configures all the recommended agenda slots" — it does not.
- **Fix:** pass `templateId` into the form → server action, then create `event_agenda_items` and `event_tasks` from the presets in the same transaction as the event.

#### P1-2. Event activity is hardcoded
- `app/(app)/events/[id]/activity/page.tsx` renders exactly two entries ("Event created", "Event scheduled") plus a dashed "More activity coming soon" panel.
- No `event_activity` table, no `lib/activity.ts`, and no logging hooks in task/file/member/event mutations.
- `lib/events.ts:listActivityForUser` only unions "created" events and "joined" memberships, so `/my-activity` is a thin feed too.

#### P1-3. Notifications are computed, never stored
- `app/(app)/notifications/page.tsx` builds three groups on the fly from `listEventsForUser` (coming up / shared with you / needs a venue). Nothing is persisted, nothing can be marked read, and there is no per-event notification record.
- The bell in `components/topbar.tsx` and `components/sidebar.tsx` renders an unconditional rose dot — it always looks like there is unread activity.
- **Fix:** migration 10 (`event_notifications`), `lib/notifications.ts`, `markNotificationAsRead`, and a badge fed by `getUnreadNotificationCount`.

#### P1-4. Tasks cannot be edited
- `lib/task-actions.ts` exposes `createTask`, `toggleTask`, `deleteTask` only; `lib/tasks.ts` has no `updateEventTask`.
- `components/event-task-list.tsx` shows title, notes, assignee and due date but offers no edit path. A typo or wrong assignee means delete-and-recreate.

#### P1-5. Failed event deletion is silent, and `/edit` is orphaned
- `lib/event-actions.ts:deleteEventAction` redirects to `/events/${eventId}/edit?error=…` on failure, but `app/(app)/events/[id]/edit/page.tsx` never reads `searchParams`, so the reason is discarded.
- Nothing links to `/events/[id]/edit`: the header (`components/event-header.tsx`) and tabs point at `/settings` only. The edit page duplicates the settings form and its delete dialog, so the app now has two edit surfaces, one of them unreachable.

#### P1-6. The ⌘K hint is decorative
- `components/topbar.tsx` renders a `<kbd>⌘K</kbd>` inside the search input, but no key handler exists and there is no command palette. Search only runs on form submit to `/search`.

#### P1-7. Search covers less than it advertises
- The topbar placeholder says "Search events, templates…", but `lib/search.ts` queries only `events` and `event_tasks`. Templates, members, and files are not searchable.
- `/search` also has no pagination or result limit UI (hard-coded `LIMIT 20` per type).

### 3.3 P2 — hygiene, docs, and operational risk

| # | Finding | Where |
| :--- | :--- | :--- |
| P2-1 | Destructive/error feedback uses `window.alert()` in 8 places instead of inline states | `components/event-task-list.tsx:212,229`, `components/event-agenda-list.tsx:603,616`, `components/event-members-client.tsx:90,103,124,139` |
| P2-2 | Dead file left in source tree | `lib/db.ts.bak` (stale copy of the migration runner) |
| P2-3 | `/.dev-server.log` is committed-adjacent but not ignored | `.gitignore` has no `*.log` except npm/yarn debug variants |
| P2-4 | README is still the `create-next-app` text (plus the Gmail section) — no routes, roles, storage, or deploy notes | `README.md` |
| P2-5 | No tests, no `test` script, no CI config | `package.json` |
| P2-6 | Session secret silently falls back to a known default | `lib/session.ts:6` — `process.env.AUTH_SECRET ?? "eventpulse-development-secret"`; if `AUTH_SECRET` is unset in production the app boots happily with a forgeable secret |
| P2-7 | Deployment constraint not documented: data lives in `data/eventpulse.db` (SQLite) and uploads in `data/uploads/` | `lib/db.ts`, `lib/files.ts` — neither survives an ephemeral/serverless filesystem (e.g. Vercel); needs a persistent host or a swap to hosted DB + object storage |
| P2-8 | No global `not-found`, `error`, or `loading` boundaries — only the event-scoped `app/(app)/events/[id]/not-found.tsx` | `app/` |
| P2-9 | `README`/docs claim invitation emails require public HTTPS through `APP_URL`, but the fail-fast behaviour when it is missing is untested/undocumented | `lib/event-invite-email.ts`, `.env.example` |

---

## 4. What is in good shape (verified)

- **Route protection:** `proxy.ts` gates everything except `/`, auth pages, `/api/v1/auth/*`, and `/invite/*`, and preserves `?next=` for deep links. Note `proxy.ts` is the Next 16 replacement for `middleware.ts` — correct choice here.
- **Role model:** `lib/roles.ts` centralises owner/admin/member/viewer permissions and every mutation re-checks the role server-side (`updateEvent`, `deleteEvent`, `createAgendaItem`, file upload/download/delete, member changes).
- **File access control:** `lib/files.ts` checks `canManageFiles` / `canViewFiles` / `canDelete` per request; the two API routes in `app/api/events/[id]/files/**` authenticate independently and set `private, no-store` + `nosniff`.
- **Invitations:** token-based, email-matched, expiring, with pending/declined/accepted states and owner/admin gating.
- **Agenda:** complete CRUD with status transitions (`scheduled` / `live` / `completed`) and a working interactive editor.
- **Cache Components discipline:** dynamic routes consistently wrap in `<Suspense>` and use `await connection()` / `export const instant = false`, matching Next 16 requirements.

---

## 5. Suggested order of work

| Order | Item | Effort | Why first |
| :--- | :--- | :--- | :--- |
| 1 | Fix `Date.now()` purity error (P0-4) | minutes | Unblocks `npm run lint` as a gate |
| 2 | Decide the owner of `/` and remove the duplicate (P0-1) | minutes | Restores the public landing page or removes dead code |
| 3 | Real password reset (P0-2) | half day | Users currently hit a dead end |
| 4 | Template persistence + preset seeding (P0-3, P1-1) | one day | The templates section is the most visibly unfinished feature |
| 5 | Task editing (P1-4) | half day | Smallest remaining functional gap in a shipped tab |
| 6 | Notifications table + badge (P1-3) | one day | Removes the permanently-red bell and makes the feed real |
| 7 | Activity logging (P1-2) | one day | Needs the log hooks to be added across mutations |
| 8 | `/edit` cleanup + delete error surfacing (P1-5) | small | Removes a confusing duplicate route |
| 9 | Search expansion + ⌘K palette (P1-6, P1-7) | one day | Polish; depends on a search API shape |
| 10 | Ops hardening: `AUTH_SECRET` fail-fast, persistent storage plan, README (P2-6, P2-7) | small | Prevents a production incident |

---

## 6. Re-verifying this audit

```bash
npx tsc --noEmit     # expected: exit 0
npm run lint         # expected after P0-4 fix: exit 0
```

Route-by-route status lives in [`REQUIRED_PAGES.md`](./REQUIRED_PAGES.md).
