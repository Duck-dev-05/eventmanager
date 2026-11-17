# EventPulse — Required Pages & Functions Specification

**Document Version:** 2.0 (Updated Post Phase-1 Implementation)  
**Project:** EventPulse (`eventmanager`)  
**Stack:** Next.js 16 (Turbopack, App Router, React 19), Node 22 built-in SQLite (`DatabaseSync`), Tailwind CSS v4, Nodemailer.  
**Scope:** Complete inventory of implemented pages, remaining backend server functions, database schema migrations, and UI components required to complete the application.

---

## Table of Contents
1. [Codebase Audit & Status Overview](#1-codebase-audit--status-overview)
2. [Pages & Routes Status](#2-pages--routes-status)
3. [Required Database Migrations (`lib/db.ts`)](#3-required-database-migrations-libdbts)
4. [Backend Functions & Server Actions](#4-backend-functions--server-actions)
5. [Frontend Components & Dialogs](#5-frontend-components--dialogs)
6. [Resolved Bugs & Remaining Gaps](#6-resolved-bugs--remaining-gaps)
7. [Implementation Phasing & Priority Matrix](#7-implementation-phasing--priority-matrix)

---

## 1. Codebase Audit & Status Overview

All core application pages (Root landing, Global search, Host-only settings, Event editing, Print run sheets, Template previews, and Password recovery) have now been created and integrated. The next focus is implementing interactive timeline/agenda CRUD, persistent notifications, and real workspace activity logging.

### Feature Health Matrix

| Area | Current State | Notes & Implemented Features |
| :--- | :--- | :--- |
| **Root Routing** | ✅ **Implemented** | [`app/page.tsx`](file:///D:/Code/Event/eventmanager/app/page.tsx) and [`proxy.ts`](file:///D:/Code/Event/eventmanager/proxy.ts) redirect logged-in users to `/dashboard` and unauthenticated visitors to `/login` (public landing page removed). |
| **Workspace Search** | ✅ **Implemented** | [`app/(app)/search/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/search/page.tsx) queries events and tasks via [`lib/search.ts`](file:///D:/Code/Event/eventmanager/lib/search.ts). Topbar search bar submits directly to `/search`. |
| **Event Editing & Deletion** | ✅ **Implemented** | [`app/(app)/events/[id]/edit/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/events/[id]/edit/page.tsx) with `updateEventAction`, `deleteEventAction`, and [`components/delete-event-dialog.tsx`](file:///D:/Code/Event/eventmanager/components/delete-event-dialog.tsx). |
| **Host-Only Settings Tab** | ✅ **Implemented** | [`app/(app)/events/[id]/settings/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/events/[id]/settings/page.tsx) with strict role-gating (`role === 'owner'`). Hidden from members, admins, and viewers. |
| **Event Overview** | ✅ **Bug Fixed** | Displays actual event creator via `getEventOwner(eventId)` rather than current viewer. |
| **Templates** | 🟡 **Partially Implemented** | Built-in presets loaded via [`lib/templates.ts`](file:///D:/Code/Event/eventmanager/lib/templates.ts). Preview page ([`/templates/[id]`](file:///D:/Code/Event/eventmanager/app/(app)/templates/[id]/page.tsx)), creation page ([`/templates/new`](file:///D:/Code/Event/eventmanager/app/(app)/templates/new/page.tsx)), and prefill flow ([`/events/new?templateId=`](file:///D:/Code/Event/eventmanager/app/(app)/events/new/page.tsx)) are live. Persistent DB storage pending. |
| **Print Run Sheet** | ✅ **Implemented** | [`app/(app)/events/[id]/print/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/events/[id]/print/page.tsx) with clean print styling and one-click print button. |
| **Password Recovery** | ✅ **Implemented** | [`app/forgot-password/page.tsx`](file:///D:/Code/Event/eventmanager/app/forgot-password/page.tsx) and [`app/reset-password/[token]/page.tsx`](file:///D:/Code/Event/eventmanager/app/reset-password/[token]/page.tsx) created and linked from login. |
| **Event Schedule / Agenda** | ✅ **Implemented** | Interactive timeline CRUD with `event_agenda_items`, status transitions, quick presets, and `EventAgendaList`. |
| **Event Activity Log** | ⚠️ **Needs Persistence** | Displays hardcoded start/creation items. Needs `event_activity` table and dynamic action hooks. |
| **Notifications** | ⚠️ **Needs Persistence** | Dynamic on-the-fly groupings only. Needs real `event_notifications` table, mark-as-read actions, and unread bell badge. |
| **Tasks** | ⚠️ **Needs Update Action** | Can create, delete, and toggle status. Missing `updateEventTask` to edit title, deadline, notes, and assignee. |
| **Files** | ⚠️ **Minor Enhancements** | Upload, preview, and delete work well. Missing file rename and storage usage summary. |

---

## 2. Pages & Routes Status

### 2.1. Root Redirect Page
- **Route:** `/`
- **File:** [`app/page.tsx`](file:///D:/Code/Event/eventmanager/app/page.tsx)
- **Status:** ✅ **Implemented**
- **Behavior:** Redirects logged-in users to `/dashboard` and unauthenticated guests directly to `/login`. Home landing page removed.

### 2.2. Global Workspace Search Page
- **Route:** `/search?q={query}`
- **File:** [`app/(app)/search/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/search/page.tsx)
- **Status:** ✅ **Implemented**
- **Features:** Reads `searchParams.q`, queries events and tasks via [`lib/search.ts`](file:///D:/Code/Event/eventmanager/lib/search.ts), and provides direct navigation back to events and task boards.

### 2.3. Event Host-Only Settings Page & Tab
- **Route:** `/events/[id]/settings`
- **File:** [`app/(app)/events/[id]/settings/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/events/[id]/settings/page.tsx)
- **Status:** ✅ **Implemented**
- **Access Control:** Strictly restricted to the event host (`role === "owner"`). Admins, members, and viewers are redirected back to `/events/[id]`.
- **Navigation:** Added to [`components/event-tabs.tsx`](file:///D:/Code/Event/eventmanager/components/event-tabs.tsx) and [`components/event-header.tsx`](file:///D:/Code/Event/eventmanager/components/event-header.tsx) exclusively for the host.

### 2.4. Event Edit Page & Danger Zone
- **Route:** `/events/[id]/edit`
- **File:** [`app/(app)/events/[id]/edit/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/events/[id]/edit/page.tsx)
- **Status:** ✅ **Implemented**
- **Features:** Pre-populates all event values, supports `updateEventAction`, and embeds [`components/delete-event-dialog.tsx`](file:///D:/Code/Event/eventmanager/components/delete-event-dialog.tsx) with title confirmation. Wrapped in `<Suspense>` streaming with `export const instant = false`.

### 2.5. Template Blueprint Preview Page
- **Route:** `/templates/[id]`
- **File:** [`app/(app)/templates/[id]/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/templates/[id]/page.tsx)
- **Status:** ✅ **Implemented**
- **Features:** Displays suggested duration, capacity, venue recommendation, preset agenda slots, and starter checklist items. Includes a primary "Use this template" button.

### 2.6. New Template Page
- **Route:** `/templates/new`
- **File:** [`app/(app)/templates/new/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/templates/new/page.tsx)
- **Status:** ✅ **Implemented**
- **Features:** Form to design reusable blueprints with category presets, descriptions, and venue defaults.

### 2.7. Printable Event Run Sheet
- **Route:** `/events/[id]/print`
- **File:** [`app/(app)/events/[id]/print/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/events/[id]/print/page.tsx)
- **Status:** ✅ **Implemented**
- **Features:** High-contrast run sheet for event day operations showing schedule, staff contact cards, checklist progress, and incident notes. Includes [`components/print-button.tsx`](file:///D:/Code/Event/eventmanager/components/print-button.tsx) and a direct menu link in [`components/share-menu.tsx`](file:///D:/Code/Event/eventmanager/components/share-menu.tsx).

### 2.8. Password Recovery Pages
- **Routes:** `/forgot-password` and `/reset-password/[token]`
- **Files:** [`app/forgot-password/page.tsx`](file:///D:/Code/Event/eventmanager/app/forgot-password/page.tsx) & [`app/reset-password/[token]/page.tsx`](file:///D:/Code/Event/eventmanager/app/reset-password/[token]/page.tsx)
- **Status:** ✅ **Implemented**
- **Features:** Self-service password recovery forms styled with `AuthShell` and linked from the login form.

### 2.9. Users & Team Management Page
- **Route:** `/users`
- **File:** [`app/(app)/users/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/users/page.tsx)
- **Status:** ✅ **Implemented**
- **Features:** Complete workspace user directory with search, live event activity badges (events owned and joined), admin creation of users with initial passwords, inline editing of user names/emails, administrative password resets, and cascaded account deletion.

---

## 3. Required Database Migrations (`lib/db.ts`)

To finalize the remaining modules, add the following migrations to `lib/db.ts`:

### Migration 7: Event Agenda Items (Next Priority)
```sql
CREATE TABLE event_agenda_items (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location TEXT NOT NULL DEFAULT '',
  speaker_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'live', 'completed', 'cancelled'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX event_agenda_event_idx ON event_agenda_items (event_id, starts_at);
```

### Migration 8: Persistent Event Templates
```sql
CREATE TABLE event_templates (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users (id) ON DELETE SET NULL, -- NULL = system built-in template
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL DEFAULT '',
  default_venue TEXT NOT NULL DEFAULT '',
  default_capacity INTEGER,
  default_duration_minutes INTEGER DEFAULT 60,
  structure_json TEXT NOT NULL DEFAULT '{}',
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX event_templates_owner_idx ON event_templates (owner_id);
```

### Migration 9: Event Activity Log
```sql
CREATE TABLE event_activity (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'event_created', 'event_updated', 'task_created', 'task_completed', 'file_uploaded', 'member_invited', 'member_joined', 'member_removed', 'agenda_updated'
  summary TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX event_activity_event_idx ON event_activity (event_id, created_at DESC);
CREATE INDEX event_activity_actor_idx ON event_activity (actor_id, created_at DESC);
```

### Migration 10: User Notifications
```sql
CREATE TABLE event_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events (id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'invite_received', 'task_assigned', 'task_due_soon', 'event_updated', 'role_changed'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX event_notifications_user_unread_idx ON event_notifications (user_id, read_at);
```

### Migration 11: Password Resets
```sql
CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX password_resets_token_idx ON password_resets (token);
```

---

## 4. Backend Functions & Server Actions

### 4.1. Events Module (`lib/events.ts` & `lib/event-actions.ts`)
- ✅ `updateEvent({ eventId, actorId, ...fields })` — Implemented and active.
- ✅ `deleteEvent({ eventId, actorId })` — Implemented with cascaded DB deletion and file removal.
- ✅ `getEventOwner(eventId)` — Implemented and active.
- [ ] `duplicateEvent({ eventId, actorId, newTitle, newDate })` — Clone event with agenda and task checklists.
- [ ] `exportEventIcs(eventId)` — Generate standard RFC 5545 `.ics` file for calendar imports.

### 4.2. Agenda & Timeline Module (`lib/agenda.ts` & `lib/agenda-actions.ts`)
- ✅ `getEventAgenda(eventId: string): Promise<AgendaItem[]>` — Retrieve timeline items.
- ✅ `createAgendaItem(input)` — Add timeline entry with title, time, duration, speaker, location.
- ✅ `updateAgendaItem(input)` — Modify item details.
- ✅ `deleteAgendaItem({ eventId, itemId, actorId })` — Remove item.
- ✅ `setAgendaItemStatus({ eventId, itemId, actorId, status })` — Toggle scheduled / live / completed.

### 4.3. Real Activity Logging (`lib/activity.ts`)
- [ ] `logEventActivity(input)` — Record event mutations.
- [ ] `getEventActivity(eventId, limit)` — Dynamic query replacing hardcoded activity in `/events/[id]/activity`.
- [ ] `listUserWorkspaceActivity(userId, limit)` — Real workspace feed for `/my-activity`.
- [ ] Auto-logging triggers hooked into task, file, member, and event operations.

### 4.4. Notifications (`lib/notifications.ts` & `lib/notification-actions.ts`)
- [ ] `createNotification(input)` — Store notification record.
- [ ] `listNotificationsForUser(userId)` — Fetch persistent user notifications for `/notifications`.
- [ ] `getUnreadNotificationCount(userId)` — Count unread items for topbar bell badge.
- [ ] `markNotificationAsRead(...)` & `markAllNotificationsAsRead(userId)`.

### 4.5. Tasks & Files Enhancements (`lib/tasks.ts`, `lib/files.ts`)
- [ ] `updateEventTask(input)` — Edit existing task details (title, notes, deadline, assignee).
- [ ] Notify assignee when a task is assigned or nearing its deadline.
- [ ] `renameEventFile({ eventId, fileId, newName, actorId })`.

---

## 5. Frontend Components & Dialogs

- ✅ [`components/delete-event-dialog.tsx`](file:///D:/Code/Event/eventmanager/components/delete-event-dialog.tsx) — Title-matching confirmation modal for deletion.
- ✅ [`components/print-button.tsx`](file:///D:/Code/Event/eventmanager/components/print-button.tsx) — Client-side print trigger.
- ✅ Updated [`components/event-form.tsx`](file:///D:/Code/Event/eventmanager/components/event-form.tsx) — Enhanced with initial values, edit labels, and cancellation hrefs.
- ✅ Updated [`components/event-tabs.tsx`](file:///D:/Code/Event/eventmanager/components/event-tabs.tsx) — Host-gated Settings tab.
- ✅ Updated [`components/event-header.tsx`](file:///D:/Code/Event/eventmanager/components/event-header.tsx) — Host-only Settings shortcut.
- ✅ [`components/event-agenda-list.tsx`](file:///D:/Code/Event/eventmanager/components/event-agenda-list.tsx) — Interactive schedule editor and timeline manager for `/events/[id]/schedule`.
- [ ] `components/task-edit-dialog.tsx` — Modal to edit task details.
- [ ] `components/notification-badge.tsx` — Red unread count badge on topbar bell.

---

## 6. Resolved Bugs & Remaining Gaps

1. **Root 404 Error:** ✅ **Resolved** by creating [`app/page.tsx`](file:///D:/Code/Event/eventmanager/app/page.tsx).
2. **Organizer Identity Bug:** ✅ **Resolved** in [`app/(app)/events/[id]/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/events/[id]/page.tsx) using `getEventOwner`.
3. **Deep-linking in `proxy.ts`:** ✅ **Resolved** in [`proxy.ts`](file:///D:/Code/Event/eventmanager/proxy.ts) preserving `?next=` and whitelisting public routes.
4. **Settings `defaultCapacity` Disconnected:** ✅ **Resolved** in [`app/(app)/events/new/page.tsx`](file:///D:/Code/Event/eventmanager/app/(app)/events/new/page.tsx) reading user preferences.
5. **Topbar Search Inactive:** ✅ **Resolved** in [`components/topbar.tsx`](file:///D:/Code/Event/eventmanager/components/topbar.tsx) by submitting directly to `/search`.
6. **Next.js 16 Route Streaming Warnings:** ✅ **Resolved** in `/edit`, `/print`, and `/new` routes with `export const instant = false` and `<Suspense>` wrappers.

---

## 7. Implementation Phasing & Priority Matrix

```mermaid
flowchart TD
    subgraph Phase 1: Core Pages & Host Settings [COMPLETED]
        P1A["Root Page (app/page.tsx)"]
        P1B["Fix Organizer Display Bug"]
        P1C["Event Edit Page & updateEvent"]
        P1D["Event Delete & Danger Zone Modal"]
        P1E["Host-Only Settings Tab & Page"]
        P1F["Global Search Page & Topbar"]
        P1G["Print Run Sheet (app/.../print)"]
        P1H["Templates Preview & New Page"]
        P1I["Password Recovery Pages"]
    end

    subgraph Phase 2: Live Schedule & Task Editing [NEXT PRIORITY]
        P2A["DB Migration 7: event_agenda_items"]
        P2B["Agenda CRUD Actions (lib/agenda.ts)"]
        P2C["Interactive Timeline: event-agenda-list.tsx"]
        P2D["Task Edit Action: updateEventTask"]
    end

    subgraph Phase 3: Real Activity & True Notifications
        P3A["DB Migration 9 & 10: activity & notifications"]
        P3B["Activity Logging System & Real Feeds"]
        P3C["Persistent Notifications & Bell Badge Counter"]
    end

    subgraph Phase 4: Templates DB & Calendar Sync
        P4A["DB Migration 8: event_templates"]
        P4B["Save Event as Template Action"]
        P4C["iCal (.ics) Calendar Export"]
    end

    Phase 1 --> Phase 2 --> Phase 3 --> Phase 4
```

| Phase | Milestone | Status | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Core Pages & Host Controls** | ✅ **Completed** | Root hero & redirect, Search, Edit event, Host-only Settings tab, Print run sheets, Template previews, Password recovery, and navigation bug fixes. |
| **Phase 2** | **Schedule & Task Parity** | 🚀 **Next Up** | `event_agenda_items` migration, interactive timeline component, agenda CRUD, and task editing (`updateEventTask`). |
| **Phase 3** | **Activity & Notifications** | ⏳ **Queued** | `event_activity` & `event_notifications` migrations, real activity feeds, and unread bell badge. |
| **Phase 4** | **Templates DB & iCal Sync** | ⏳ **Queued** | Database-backed custom templates and `.ics` calendar sync files. |
