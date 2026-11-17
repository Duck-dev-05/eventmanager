# EventPulse — Route Inventory & Pages Still To Build

**Companion to:** [`PROJECT_AUDIT.md`](./PROJECT_AUDIT.md) (issues and priorities)
**Last verified against source:** 14 November 2026

Legend: ✅ working · 🟡 partial (works, but the feature is incomplete) · ❌ UI only (renders, does nothing) · ⚠️ unreachable

---

## 1. Existing routes

### 1.1 Public / auth

| Route | File | State | Notes |
| :--- | :--- | :--- | :--- |
| `/` | `app/page.tsx` | ⚠️ unreachable | Landing hero, features, footer. `next.config.ts` redirects `/` → `/dashboard` before routing, so this never renders. |
| `/login` | `app/login/page.tsx` | ✅ | Password + optional Google, preserves `?next=`. |
| `/register` | `app/register/page.tsx` | ✅ | Name/email/password, preserves `?next=`. |
| `/forgot-password` | `app/forgot-password/page.tsx` | ✅ | Issues a single-use token (60 min) and emails the link; neutral message for unknown emails. |
| `/reset-password/[token]` | `app/reset-password/[token]/page.tsx` | ✅ | Validates the token, writes the new password, burns the token. |
| unmatched URLs | `app/not-found.tsx` | ✅ | Branded 404 for signed-in users; guests are bounced to `/login` by `proxy.ts`. |

### 1.2 Workspace

| Route | File | State | Notes |
| :--- | :--- | :--- | :--- |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | ✅ | Stat cards, upcoming list, quick links. Contains the lint error (`Date.now()` in render). |
| `/my-events` | `app/(app)/my-events/page.tsx` | ✅ | Owned + shared events, search/filter via `components/events-list.tsx`. |
| `/calendar?month=YYYY-MM` | `app/(app)/calendar/page.tsx` | ✅ | Month grid + agenda sidebar; prev/next/today. |
| `/search?q=` | `app/(app)/search/page.tsx` | 🟡 | Queries events + tasks only; placeholder text mentions templates. |
| `/notifications` | `app/(app)/notifications/page.tsx` | 🟡 | Derived groups at render time; no persistence, no read state. |
| `/my-activity` | `app/(app)/my-activity/page.tsx` | 🟡 | Feed of "created" + "joined" only. |
| `/templates` | `app/(app)/templates/page.tsx` | ✅ | Saved templates first, then the 4 built-in presets. |
| `/templates/new` | `app/(app)/templates/new/page.tsx` | ✅ | Saves to `event_templates` and redirects to the new blueprint. |
| `/templates/[id]` | `app/(app)/templates/[id]/page.tsx` | ✅ | Renders built-ins and the owner's saved templates; delete action for custom ones. |
| `/profile` | `app/(app)/profile/page.tsx` | 🟡 | Name editable; no password change, no account actions. |
| `/settings` | `app/(app)/settings/page.tsx` | ✅ | Reminder/email/digest toggles + default capacity. Toggles do not drive any sender yet. |
| `/help` | `app/(app)/help/page.tsx` | ✅ | FAQ + support mailto. |

### 1.3 Events

| Route | File | State | Notes |
| :--- | :--- | :--- | :--- |
| `/events/new?templateId=` | `app/(app)/events/new/page.tsx` | 🟡 | Prefills title/description/category/venue/capacity; does not seed agenda/tasks. |
| `/events/[id]` | `.../events/[id]/page.tsx` | ✅ | About, at-a-glance facts, real organizer, schedule card. |
| `/events/[id]/tasks` | `.../tasks/page.tsx` | 🟡 | Create / toggle / delete; no edit. |
| `/events/[id]/members` | `.../members/page.tsx` | ✅ | Roles, invites, pending invitations, leave/decline. |
| `/events/[id]/schedule` | `.../schedule/page.tsx` | ✅ | Full agenda CRUD + status transitions. |
| `/events/[id]/files` | `.../files/page.tsx` | 🟡 | Upload / PPTX preview / download / delete; no rename or size summary. |
| `/events/[id]/activity` | `.../activity/page.tsx` | 🟡 | Two hardcoded rows + "coming soon" panel. |
| `/events/[id]/settings` | `.../settings/page.tsx` | ✅ | Owner-only; form + danger zone. |
| `/events/[id]/edit` | `.../edit/page.tsx` | ⚠️ orphaned | Duplicate of settings; no inbound link; ignores `?error=` from failed delete. |
| `/events/[id]/print` | `.../print/page.tsx` | ✅ | Clean run sheet + print button. |
| `/invite/[token]` | `app/(app)/invite/[token]/page.tsx` | ✅ | Email-matched accept/decline with expiry. |

### 1.4 API

| Route | Methods | Notes |
| :--- | :--- | :--- |
| `/api/events/[id]/files` | `POST` | Upload (20 MB cap), session + role checked. |
| `/api/events/[id]/files/[fileId]` | `GET`, `DELETE` | `?inline=1` for preview; `private, no-store`. |
| `/api/v1/auth/google` | `GET` | OAuth start (PKCE). |
| `/api/v1/auth/google/callback` | `GET` | OAuth callback. |

---

## 2. Pages worth creating

Ordered by value. Each entry lists the file to add, why it is needed, and what "done" means.

### 2.1 Global 404 — `app/not-found.tsx` — ✅ shipped
- **Why:** every unknown URL currently falls through to Next's unstyled default; only the event subtree has a branded 404 (`app/(app)/events/[id]/not-found.tsx`).
- **Done when:** unknown routes render a branded page with links to `/dashboard` and `/` (or `/login` for guests).

### 2.2 Error boundaries — `app/(app)/error.tsx` + `app/global-error.tsx` — ✅ shipped
- **Why:** the data layer is synchronous SQLite (`node:sqlite`) plus disk I/O. A locked or missing DB file throws mid-render and the user gets the raw error surface. There is no `error.tsx` anywhere.
- **Done when:** a thrown render error shows a retry button (`reset()`), logs a digest, and keeps the shell/navigation intact.

### 2.3 Password reset pages (backend, not new routes) — ✅ shipped
Added: migration 12 `password_resets`, `lib/password-reset.ts`, `lib/password-reset-email.ts`,
`lib/password-actions.ts`, and the two client forms. Email delivery needs `GMAIL_USER`,
`GMAIL_APP_PASSWORD` and `APP_URL`; outside production the page shows the link directly when
mail is not configured.
- **Why:** the two existing pages are decorative (see audit P0-2).
- **Scope:** migration 11 `password_resets (id, user_id, token, expires_at, used_at, created_at)`; `requestPasswordReset(email)` always returns the same neutral message; `sendPasswordResetEmail` via the existing Nodemailer transport; `resetPassword({ token, newPassword })` validates expiry + single use and updates `users.password_hash`.
- **Done when:** `/forgot-password` reports "check your inbox" for known and unknown emails alike, and `/reset-password/[token]` rejects expired/used tokens and signs the user in on success.

### 2.4 Change password — extend `/profile` or add `/settings/security` (P1)
- **Why:** a signed-in user has no way to change their password, and no way to set one if they signed up with Google.
- **Recommendation:** a `Security` card on `/profile` (no new route) with `changePassword({ userId, currentPassword, newPassword })`; hide the current-password field for `provider === "google"`.
- **Done when:** wrong current password shows a field error and a successful change rotates the session cookie.

### 2.5 Persisted templates — ✅ shipped (create/list/detail/delete)
Migration 11 `event_templates` plus `lib/template-actions.ts`. Still open: templates cannot
define agenda or checklist presets in the UI yet (see 2.6).
- **Why:** creation is a placeholder and only built-ins exist.
- **Scope:** migration 8 `event_templates`; `lib/template-actions.ts` with `createTemplate`, `deleteTemplate`, `listTemplatesForUser`; merge custom + built-in in `listTemplates`; add an `isOwner` delete action on the detail page.
- **Done when:** a saved template survives a server restart, appears in `/templates`, and its detail page renders presets from the stored `structure_json`.

### 2.6 Seeded "Use template" flow — `/events/new?templateId=` (P1)
- **Why:** the detail page promises the agenda and checklist are pre-built; they are not.
- **Scope:** hidden `templateId` in `components/event-form.tsx`; `publishEvent` creates the event, then agenda items (offset from `startsAt` by each preset's duration) and task rows inside one transaction.
- **Done when:** creating from "Tech Innovation Conference" yields 6 agenda items and 4 open tasks on the new event.

### 2.7 Notification center, real — `/notifications` (P1)
- **Why:** the page is a render-time approximation and the bell dot is always on.
- **Scope:** migration 10 `event_notifications`; `lib/notifications.ts` (`createNotification`, `listNotificationsForUser`, `getUnreadNotificationCount`, `markNotificationAsRead`, `markAllNotificationsAsRead`); `components/notification-badge.tsx` replacing the hardcoded dot in `topbar.tsx` / `sidebar.tsx`; emit on invite received, task assigned, role changed, event updated.
- **Done when:** unread count is accurate, "Mark all read" persists, and a task assignment produces exactly one notification for the assignee.

### 2.8 Event activity log, real — `/events/[id]/activity` (P1)
- **Why:** hardcoded rows plus "coming soon".
- **Scope:** migration 9 `event_activity`; `lib/activity.ts` (`logEventActivity`, `getEventActivity`); hooks in task create/toggle/delete, file upload/delete, member invite/role change/removal, event update, agenda CRUD.
- **Done when:** completing a task immediately shows an entry with actor and timestamp, and `/my-activity` reuses `listUserWorkspaceActivity`.

### 2.9 Task edit dialog — `components/task-edit-dialog.tsx` (P1)
- **Why:** `updateEventTask` does not exist; fixing a title or reassigning work requires delete + recreate.
- **Scope:** `updateEventTask({ eventId, taskId, actorId, title, notes, assigneeId, dueAt })` gated by `rolePermissions.canEdit`; dialog opened from each row in `components/event-task-list.tsx`.
- **Done when:** edits persist and a viewer sees no edit affordance.

### 2.10 Calendar export — `app/api/events/[id]/ics/route.ts` (P2)
- **Why:** no way to put an event into a personal calendar; `share-menu.tsx` already has room for another entry.
- **Scope:** RFC 5545 text/calendar response with `UID`, `DTSTART`/`DTEND`, `SUMMARY`, `LOCATION`, `DESCRIPTION`; session + role checked.
- **Done when:** the download opens correctly in Google Calendar and Apple Calendar.

### 2.11 Duplicate event — action + button, no new route (P2)
- **Why:** recurring events currently mean re-entering everything.
- **Scope:** `duplicateEvent({ eventId, actorId, newTitle, newDate })` copying agenda and tasks; entry point in `components/event-header.tsx` or the settings page.
- **Done when:** a duplicate keeps agenda/checklist and navigates to the copy.

### 2.12 File rename — inline, `components/event-files-client.tsx` (P2)
- **Why:** uploaded names are immutable; typos are permanent.
- **Scope:** `renameEventFile({ eventId, fileId, newName, actorId })` with the same permission check as delete, plus an inline editable name.
- **Done when:** the new name survives reload and invalid names are rejected.

### 2.13 Search coverage + ⌘K palette — `lib/search.ts`, `components/search-palette.tsx` (P2)
- **Why:** the topbar advertises templates (not searched) and a ⌘K shortcut (not wired).
- **Scope:** add `event_templates`, members, and file names to `searchWorkspace`; client palette opened by `⌘K` / `Ctrl+K` with keyboard navigation, reusing the same query.
- **Done when:** ⌘K focuses the palette from any page and a template name is returned in results.

### 2.14 `/events/[id]/edit` decision (P2)
Not a new page — a cleanup decision. Either delete it and keep `/settings` as the single edit surface (recommended, since the header and tabs already point there), or link it from settings and make `/settings` read-only summary. While deciding, make the delete failure visible: `deleteEventAction` already appends `?error=`, but the edit page ignores it.

---

## 3. Deliberately not needed

These were considered and rejected so they don't creep into the backlog:

- **Public event/registration page** — this is a team event-operations workspace; the only public surface is `/invite/[token]`, which already exists.
- **Per-event notification preferences** — user-level toggles on `/settings` are sufficient for the app's scope.
- **Payments, ticketing, check-in** — no product requirement in the code or docs.
- **A separate `/dashboard` variant for members** — the current dashboard already merges owned and shared events.
