// Parses the body sent by the iOS Shortcut into normalized reminders.
// Shortcuts can send JSON in a few shapes depending on how the user built the request, so we accept:
//   { reminders: [ {...}, ... ] }        JSON body with an array field
//   { reminders: "<text>" } / { lines: "<text>" }   text holding a JSON array, NDJSON or concatenated objects
//   [ {...}, ... ]                       bare array
//   "<text>"                             text/plain body in any of the text forms above

export interface ParsedReminder {
  title: string; notes: string | null; list: string | null;
  dueAt: Date | null; allDay: boolean; completed: boolean; flagged: boolean; priority: number;
}

const MAX_ITEMS = 1000;

/** Extracts every top-level {...} object from text (handles pretty-printed dictionaries joined by newlines). */
function extractObjects(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try { const whole = JSON.parse(trimmed); return Array.isArray(whole) ? whole : [whole]; } catch {}
  const out: unknown[] = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (inString) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === '{') { if (depth++ === 0) start = i; }
    else if (c === '}' && depth > 0 && --depth === 0) {
      try { out.push(JSON.parse(trimmed.slice(start, i + 1))); } catch {}
    }
  }
  return out;
}

function toItems(body: unknown): unknown[] {
  if (typeof body === 'string') return extractObjects(body);
  if (Array.isArray(body)) return body.flatMap(item => typeof item === 'string' ? extractObjects(item) : [item]);
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const field = record.reminders ?? record.lines ?? record.items;
    if (field !== undefined) return toItems(field);
    if ('title' in record) return [record];
  }
  return [];
}

const pick = (item: Record<string, unknown>, ...keys: string[]) => {
  const lower = Object.fromEntries(Object.entries(item).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]/g, ''), v]));
  for (const key of keys) if (lower[key] !== undefined && lower[key] !== null && lower[key] !== '') return lower[key];
  return undefined;
};

function toBool(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return typeof value === 'string' && /^(true|yes|s[ií]|1|verdadero)$/i.test(value.trim());
}

/** 0 none · 1 low · 2 medium · 3 high. Accepts Shortcuts' labels (EN/ES) or Apple's numeric scale (1–4 high, 5 medium, 6–9 low). */
function toPriority(value: unknown) {
  if (typeof value === 'string' && isNaN(Number(value))) {
    if (/high|alta|!!!/i.test(value)) return 3;
    if (/medium|media|!!/i.test(value)) return 2;
    if (/low|baja|!/i.test(value)) return 1;
    return 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n <= 4 ? 3 : n === 5 ? 2 : 1;
}

function toText(value: unknown, max: number) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

/**
 * ISO 8601 with offset from the Shortcut's "Format Date" action. A date without time, or a
 * local midnight, is treated as an all-day reminder. Date-only values are pinned to 12:00 UTC
 * so the calendar day survives conversion to any reasonable time zone.
 */
function toDue(value: unknown, explicitAllDay: unknown): { dueAt: Date | null; allDay: boolean } {
  const text = toText(value, 64);
  if (!text) return { dueAt: null, allDay: false };
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return { dueAt: new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3], 12)), allDay: true };
  const dueAt = new Date(text);
  if (isNaN(dueAt.getTime())) return { dueAt: null, allDay: false };
  const midnight = /T00:00(:00(\.0+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(text);
  return { dueAt, allDay: explicitAllDay === undefined ? midnight : toBool(explicitAllDay) };
}

export function parseReminders(body: unknown): { reminders: ParsedReminder[]; received: number; skipped: number } {
  const items = toItems(body);
  const reminders: ParsedReminder[] = [];
  for (const raw of items.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const title = toText(pick(item, 'title', 'titulo', 'título', 'name'), 300);
    if (!title) continue;
    const due = toDue(pick(item, 'due', 'duedate', 'dueat', 'fecha'), pick(item, 'allday', 'todoeldia'));
    reminders.push({
      title,
      notes: toText(pick(item, 'notes', 'notas'), 1000),
      list: toText(pick(item, 'list', 'lista'), 100),
      completed: toBool(pick(item, 'completed', 'iscompleted', 'done', 'completado')),
      flagged: toBool(pick(item, 'flagged', 'isflagged', 'marcado')),
      priority: toPriority(pick(item, 'priority', 'prioridad')),
      ...due
    });
  }
  return { reminders, received: items.length, skipped: items.length - reminders.length };
}
