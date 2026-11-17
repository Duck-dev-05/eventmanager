# EventPulse — Implementation Checklist & Progress Tracker

> **Status: partly out of date.** A verified audit of the code as of 14 November 2026 lives in
> [`PROJECT_AUDIT.md`](./PROJECT_AUDIT.md) and the route-by-route inventory in
> [`REQUIRED_PAGES.md`](./REQUIRED_PAGES.md). Where this file disagrees with them — for example,
> agenda CRUD, global search, print sheets and event editing are now implemented — trust the audit.

> **Comprehensive Specification:** See [REQUIRED_PAGES_AND_FUNCTIONS.md](file:///D:/Code/Event/eventmanager/docs/REQUIRED_PAGES_AND_FUNCTIONS.md) for full technical architectures, SQL schemas, TypeScript function signatures, and priority matrices.

Audit of the EventPulse codebase (`D:\Code\Event\eventmanager`) tracking all missing pages, backend server functions, database tables, and UI components needed to achieve full functionality.

---

## 1. Pages & Routes Tracker

- [x] **`app/page.tsx`** — Root redirect (Landing page removed; redirects authenticated users to `/dashboard` and guests to `/login`).
- [x] **`app/(app)/search/page.tsx`** — Global workspace search page for events and tasks with topbar integration.
- [x] **`app/(app)/events/[id]/settings/page.tsx`** — Host-only settings tab and page (hidden from members, admins, and viewers).
- [x] **`app/(app)/events/[id]/edit/page.tsx`** — Event modification page for owners and admins with `updateEventAction`.
- [x] **`app/(app)/events/[id]/edit` Danger Zone** — Event deletion modal with title verification (`deleteEventAction`).
- [x] **`app/(app)/templates/[id]/page.tsx`** — Template preview and blueprint detail view.
- [x] **`app/(app)/templates/new/page.tsx`** — Create custom reusable event template.
- [x] **`app/(app)/events/[id]/print/page.tsx`** — Clean printable run sheet for event day staff.
- [x] **`app/forgot-password/page.tsx`** & **`app/reset-password/[token]/page.tsx`** — Self-service password recovery flow.
- [x] **`app/(app)/users/page.tsx`** — Workspace user management (create, search, edit, reset passwords, and delete users).

---

## 2. Database Migrations Tracker (`lib/db.ts`)

- [x] **Migration 7 (`event_agenda_items`)**: id, event_id, title, description, starts_at, duration_minutes, location, speaker_name, status, sort_order, created_at.
- [ ] **Migration 8 (`event_templates`)**: id, owner_id, name, category, description, default_venue, default_capacity, default_duration_minutes, structure_json, is_public, created_at.
- [ ] **Migration 9 (`event_activity`)**: id, event_id, actor_id, kind, summary, metadata_json, created_at.
- [ ] **Migration 10 (`event_notifications`)**: id, user_id, event_id, kind, title, message, link_url, read_at, created_at.
- [ ] **Migration 11 (`password_resets`)**: id, user_id, token, expires_at, used_at, created_at.

---

## 3. Backend Functions & Server Actions Tracker

### Events (`lib/events.ts`, `lib/event-actions.ts`)
- [x] `updateEvent({ eventId, actorId, ...fields })` — Validate manager role, update event, revalidate paths.
- [x] `deleteEvent({ eventId, actorId })` — Owner-only cascaded transaction deleting database rows and disk files in `data/uploads/<eventId>/`.
- [x] `getEventOwner(eventId)` — Resolve actual owner user instead of rendering current viewer as organizer.
- [ ] `duplicateEvent({ eventId, actorId, newTitle, newDate })` — Clone event with agenda and task checklists.
- [ ] `exportEventIcs(eventId)` — Generate standard RFC 5545 `.ics` file for calendar imports.

### Schedule & Agenda (`lib/agenda.ts`, `lib/agenda-actions.ts`)
- [x] `getEventAgenda(eventId)` — Retrieve chronological agenda timeline.
- [x] `createAgendaItem({ eventId, actorId, ...item })` — Gated with `rolePermissions.canEdit`.
- [x] `updateAgendaItem({ eventId, itemId, actorId, ...fields })` — Modify item details.
- [x] `deleteAgendaItem({ eventId, itemId, actorId })` — Gated with `rolePermissions.canDelete`.
- [x] `setAgendaItemStatus({ eventId, itemId, actorId, status })` — Toggle scheduled / live / completed.

### Real Activity Log (`lib/activity.ts`)
- [ ] `logEventActivity({ eventId, actorId, kind, summary, metadata })` — Store event-level actions.
- [ ] `getEventActivity(eventId, limit)` — Dynamic activity query replacing hardcoded entries in `/events/[id]/activity`.
- [ ] `listUserWorkspaceActivity(userId, limit)` — Real workspace feed for `/my-activity`.
- [ ] Hook logging triggers into: task mutations, file uploads/deletions, member invites/role changes, and event updates.

### Notifications Center (`lib/notifications.ts`, `lib/notification-actions.ts`)
- [ ] `createNotification({ userId, eventId, kind, title, message, linkUrl })` — Store notifications.
- [ ] `listNotificationsForUser(userId)` — Fetch persistent user notifications for `/notifications`.
- [ ] `getUnreadNotificationCount(userId)` — Count unread items for the bell badge.
- [ ] `markNotificationAsRead({ notificationId, userId })` & `markAllNotificationsAsRead(userId)`.

### Reusable Templates (`lib/templates.ts`, `lib/template-actions.ts`)
- [ ] `listTemplates(userId)` — Query built-in public presets + user custom templates.
- [ ] `getTemplateById(templateId)` — Fetch template structure and metadata.
- [ ] `createTemplate(...)` — Save custom template.
- [ ] `createEventFromTemplate({ templateId, userId, title, date, time })` — Spawn event prepopulated from template.

### Global Search (`lib/search.ts`)
- [ ] `searchWorkspace({ userId, query })` — Query across events, tasks, members, and templates scoped to user permissions.

### Tasks Module Enhancements (`lib/tasks.ts`, `lib/task-actions.ts`)
- [ ] `updateEventTask({ eventId, taskId, actorId, title, notes, assigneeId, dueAt })` — Edit existing task details.
- [ ] Send notification to assignee when a task is assigned or due date is approaching.

### Files Module Enhancements (`lib/files.ts`)
- [ ] `renameEventFile({ eventId, fileId, newName, actorId })`.
- [ ] File storage quota and event size calculator.

### Authentication & Account Security (`lib/account-actions.ts`, `lib/users.ts`)
- [ ] `changePassword({ userId, currentPassword, newPassword })`.
- [ ] `requestPasswordReset(email)` & `resetPassword({ token, newPassword })`.
- [x] Pre-populate `defaultCapacity` from user preferences when opening `/events/new`.

---

## 4. UI Components to Build

- [x] `components/event-agenda-list.tsx` — Interactive timeline editor and schedule viewer.
- [x] `components/delete-event-dialog.tsx` — Safe title-matching confirmation modal.
- [x] `components/print-button.tsx` — Clean print trigger button.
- [ ] `components/task-edit-dialog.tsx` — Edit task modal.
- [ ] `components/search-palette.tsx` — ⌘K command palette modal with keyboard navigation.
- [ ] `components/notification-badge.tsx` — Bell unread count indicator.
- [ ] `components/template-grid.tsx` & `components/use-template-modal.tsx` — Replaces empty template card grid.

---

## 5. Critical Bug Fixes

- [x] **Fix 404 on Root Route:** Create `app/page.tsx` redirecting authenticated users to `/dashboard`.
- [x] **Fix Event Organizer Bug:** Update `app/(app)/events/[id]/page.tsx` to display `getEventOwner(eventId)` rather than `user.name`.
- [x] **Fix `proxy.ts` Deep Links:** Ensure unauthenticated redirects preserve `?next=` so invitation tokens are not dropped.
- [x] **Fix Next.js 16 PPR Dynamic Navigation:** Added `export const instant = false` and `<Suspense>` wrappers across dynamic routes.
