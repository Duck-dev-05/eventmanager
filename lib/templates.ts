import { getDb } from "./db";

export type TemplateAgendaPreset = {
  title: string;
  durationMinutes: number;
  description: string;
};

export type TemplateTaskPreset = {
  title: string;
  notes: string;
};

export type EventTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultVenue: string;
  defaultCapacity: number | null;
  defaultDurationMinutes: number;
  gradient: string;
  badge: string;
  agendaPresets: TemplateAgendaPreset[];
  taskPresets: TemplateTaskPreset[];
  /** Set for templates saved by a user; built-ins have no owner. */
  ownerId?: string | null;
  isCustom?: boolean;
};

export const BUILT_IN_TEMPLATES: EventTemplate[] = [
  {
    id: "tech-conference",
    name: "Tech Innovation Conference",
    category: "Conference",
    description:
      "A full-day flagship event featuring keynote addresses, multi-track breakout sessions, sponsor booths, and an evening networking mixer.",
    defaultVenue: "Grand Convention Center, Hall A",
    defaultCapacity: 500,
    defaultDurationMinutes: 480,
    gradient: "from-indigo-600 via-violet-600 to-purple-700",
    badge: "Most popular",
    agendaPresets: [
      {
        title: "Registration & Morning Coffee",
        durationMinutes: 45,
        description: "Badge pickup, welcome swag, and breakfast buffet.",
      },
      {
        title: "Opening Keynote",
        durationMinutes: 60,
        description: "Visionary keynote by industry leadership.",
      },
      {
        title: "Track 1: Architecture & Cloud",
        durationMinutes: 90,
        description: "Deep dive technical presentations and case studies.",
      },
      {
        title: "Lunch & Sponsor Exhibition",
        durationMinutes: 75,
        description: "Catered lunch and product demonstrations.",
      },
      {
        title: "Panel Discussion & Q&A",
        durationMinutes: 60,
        description: "Interactive expert panel debate.",
      },
      {
        title: "Networking Drinks & Reception",
        durationMinutes: 90,
        description: "Casual mixer with drinks and canapés.",
      },
    ],
    taskPresets: [
      { title: "Finalize keynote speaker contracts", notes: "Confirm flight and hotel booking" },
      { title: "Review catering dietary requirements", notes: "Check vegan and gluten-free counts" },
      { title: "Test AV projector and audio mics in Hall A", notes: "Conduct dry run the day before" },
      { title: "Print attendee badges and name tags", notes: "Order lanyard ribbons" },
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch Showcase",
    category: "Webinar",
    description:
      "An energetic reveal event tailored for press, VIP customers, and ambassadors with live stage demos, QA, and media briefings.",
    defaultVenue: "Metropolitan Theater & Studio",
    defaultCapacity: 250,
    defaultDurationMinutes: 180,
    gradient: "from-rose-500 via-orange-500 to-amber-500",
    badge: "High impact",
    agendaPresets: [
      {
        title: "Doors Open & Press Check-in",
        durationMinutes: 30,
        description: "Media badge distribution and welcome drinks.",
      },
      {
        title: "The Big Reveal",
        durationMinutes: 45,
        description: "Product announcement and keynote presentation.",
      },
      {
        title: "Live Product Demonstration",
        durationMinutes: 30,
        description: "Hands-on walkthrough of new capabilities.",
      },
      {
        title: "Press QA & Executive Interviews",
        durationMinutes: 45,
        description: "Open floor for media questions and executive quotes.",
      },
    ],
    taskPresets: [
      { title: "Prepare demo hardware and backup units", notes: "Ensure offline mode fallback ready" },
      { title: "Distribute press releases under embargo", notes: "Coordinate with PR agency" },
      { title: "Coordinate live stream broadcast link", notes: "Test RTMP ingest feeds" },
    ],
  },
  {
    id: "hands-on-workshop",
    name: "Interactive Workshop / Bootcamp",
    category: "Workshop",
    description:
      "A structured classroom-style workshop focused on practical exercises, pair programming, and guided mentoring.",
    defaultVenue: "Innovation Lab & Training Room B",
    defaultCapacity: 40,
    defaultDurationMinutes: 240,
    gradient: "from-emerald-500 via-teal-600 to-cyan-700",
    badge: "Interactive",
    agendaPresets: [
      {
        title: "Setup & Prerequisites Check",
        durationMinutes: 30,
        description: "Verify local dev environments and credentials.",
      },
      {
        title: "Module 1: Core Concepts & Principles",
        durationMinutes: 60,
        description: "Interactive lecture and architecture primer.",
      },
      {
        title: "Hands-on Lab Exercise 1",
        durationMinutes: 60,
        description: "Guided implementation challenge.",
      },
      {
        title: "Module 2: Advanced Techniques",
        durationMinutes: 45,
        description: "Performance, scaling, and best practices.",
      },
      {
        title: "Review, Retrospective & Certificates",
        durationMinutes: 45,
        description: "Group code review and completion certificates.",
      },
    ],
    taskPresets: [
      { title: "Publish workshop GitHub repo and setup guide", notes: "Test on macOS, Windows, Linux" },
      { title: "Set up lab sandbox cloud accounts", notes: "Pre-seed test API tokens" },
      { title: "Prepare feedback survey form", notes: "Schedule email trigger for 5pm" },
    ],
  },
  {
    id: "community-meetup",
    name: "Community Meetup & Lightning Talks",
    category: "Meetup",
    description:
      "A friendly evening meetup uniting local community members for 3 quick lightning talks, pizza, and lively discussion.",
    defaultVenue: "Tech Hub Co-working Lounge",
    defaultCapacity: 80,
    defaultDurationMinutes: 150,
    gradient: "from-sky-500 via-blue-600 to-indigo-700",
    badge: "Community",
    agendaPresets: [
      {
        title: "Welcome & Pizza / Drinks",
        durationMinutes: 45,
        description: "Casual mingling and food.",
      },
      {
        title: "Lightning Talks (3x 15 mins)",
        durationMinutes: 45,
        description: "Three 15-minute community presentations.",
      },
      {
        title: "Open Mic & Announcements",
        durationMinutes: 20,
        description: "Hiring shouts, project showcases, and questions.",
      },
      {
        title: "Socializing & Wrap Up",
        durationMinutes: 40,
        description: "Closing conversations.",
      },
    ],
    taskPresets: [
      { title: "Order pizzas and beverages", notes: "Confirm delivery time for 6:15pm" },
      { title: "Collect speaker presentation slide decks", notes: "Combine into master deck" },
    ],
  },
];

export const CUSTOM_TEMPLATE_GRADIENT =
  "from-slate-600 via-slate-700 to-zinc-800";

type TemplateStructure = {
  agendaPresets?: TemplateAgendaPreset[];
  taskPresets?: TemplateTaskPreset[];
};

type TemplateRow = {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  description: string;
  default_venue: string;
  default_capacity: number | null;
  default_duration_minutes: number;
  structure_json: string;
  created_at: string;
};

/** Human-readable duration used on the template cards and detail page. */
export function formatTemplateDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;

  const hourLabel = `${hours} hr${hours === 1 ? "" : "s"}`;
  return rest === 0 ? hourLabel : `${hourLabel} ${rest}m`;
}

function isAgendaPreset(value: unknown): value is TemplateAgendaPreset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Record<string, unknown>;
  return (
    typeof preset.title === "string" &&
    typeof preset.description === "string" &&
    typeof preset.durationMinutes === "number"
  );
}

function isTaskPreset(value: unknown): value is TemplateTaskPreset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Record<string, unknown>;
  return typeof preset.title === "string" && typeof preset.notes === "string";
}

function parseStructure(json: string): Required<TemplateStructure> {
  try {
    const parsed = JSON.parse(json) as TemplateStructure;
    return {
      agendaPresets: Array.isArray(parsed.agendaPresets)
        ? parsed.agendaPresets.filter(isAgendaPreset)
        : [],
      taskPresets: Array.isArray(parsed.taskPresets)
        ? parsed.taskPresets.filter(isTaskPreset)
        : [],
    };
  } catch {
    return { agendaPresets: [], taskPresets: [] };
  }
}

function toTemplate(row: TemplateRow): EventTemplate {
  const structure = parseStructure(row.structure_json);

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    defaultVenue: row.default_venue,
    defaultCapacity: row.default_capacity ?? null,
    defaultDurationMinutes: row.default_duration_minutes || 60,
    gradient: CUSTOM_TEMPLATE_GRADIENT,
    badge: "Custom",
    agendaPresets: structure.agendaPresets,
    taskPresets: structure.taskPresets,
    ownerId: row.owner_id,
    isCustom: true,
  };
}

/** The user's saved templates first, then the built-in presets. */
export async function listTemplatesForUser(
  userId: string,
): Promise<EventTemplate[]> {
  const rows = getDb()
    .prepare(
      `SELECT id, owner_id, name, category, description, default_venue,
              default_capacity, default_duration_minutes, structure_json, created_at
       FROM event_templates
       WHERE owner_id = ?
       ORDER BY created_at DESC`,
    )
    .all(userId) as TemplateRow[];

  return [...rows.map(toTemplate), ...BUILT_IN_TEMPLATES];
}

/** Built-in presets are public; saved templates are visible to their owner only. */
export async function getTemplateForUser(
  id: string,
  userId: string,
): Promise<EventTemplate | null> {
  const builtIn = BUILT_IN_TEMPLATES.find((template) => template.id === id);
  if (builtIn) return builtIn;

  const row = getDb()
    .prepare(
      `SELECT id, owner_id, name, category, description, default_venue,
              default_capacity, default_duration_minutes, structure_json, created_at
       FROM event_templates
       WHERE id = ? AND owner_id = ?`,
    )
    .get(id, userId) as TemplateRow | undefined;

  return row ? toTemplate(row) : null;
}
