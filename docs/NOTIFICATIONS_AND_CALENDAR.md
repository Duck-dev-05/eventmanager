# Notifications and calendar feeds

## Email preferences

Each account controls three switches on **Settings** (`user_preferences`):

| Preference | Used by |
| --- | --- |
| Event reminders | The scheduled `npm run notify` job, 24 hours before an event starts |
| Email updates | Task-assignment email, plus future transactional updates |
| Weekly digest | The scheduled job's 7-day look-ahead email (off by default) |

Defaults match `defaultPreferences` in `lib/preferences.ts`: reminders and email
updates on, weekly digest off. Invitations are separate — they are sent whenever
an organiser invites someone and also support a copy-link fallback.

## Sending email

Email requires a Gmail app password in `.env.local`:

```bash
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
APP_URL=https://events.example.com
```

`APP_URL` makes links in emails absolute. Without Gmail credentials the app
still works: invitations return a copy-link, and the job prints `[skip]`.

## Scheduled job

```bash
npm run notify -- --dry-run   # show what would be sent
npm run notify                # send outstanding reminders and digests
```

`--dry-run` never writes to `sent_email_log`, so you can preview safely.
Every successful send is recorded in `sent_email_log`, keyed by
`reminder:<eventId>:<userId>:<date>` or `digest:<userId>:<week>`. Re-running the
job on the same day is therefore harmless.

Run it hourly in production, for example with cron:

```cron
0 * * * * cd /srv/eventpulse && /usr/bin/npm run notify >> /var/log/eventpulse-notify.log 2>&1
```

Windows Task Scheduler works the same way: run `npm run notify` from the
project directory hourly with the "Start in" field set to the project path.

## Calendar feeds

- **Per event:** “Add to calendar” in the event header downloads
  `/api/events/<id>/ics` for anyone with access.
- **Whole account:** Settings shows a personal feed URL
  (`/api/calendar/<token>`) that Google Calendar, Apple Calendar and Outlook can
  subscribe to. It lists every event the account owns or has joined.

The token lives in `users.calendar_token` and only identifies the account — it
grants no write access. **Reset link** rotates it and immediately breaks old
subscriptions. Treat the URL like a password: anyone who has it can read the
event list.
