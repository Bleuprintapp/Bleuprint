/* This Week
 *
 * The focus for the week is derived, never typed. It comes from the dated
 * plan documents the team already maintains, so the answer to "what are we
 * on this week" changes when the plan changes and not before.
 *
 * Dates in those documents are written for people: "8 to 12 Sep", "Today",
 * "Rolling", "Before first meeting". Anything that does not resolve to a
 * real date stays visible as undated work rather than being dropped, because
 * silently hiding a task is worse than admitting it has no date.
 */

const ZONE = "America/Detroit";
const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

// Calendar date in the team's own timezone, as a plain UTC-midnight Date so
// comparisons never straddle an offset.
export function localToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = type => Number(parts.find(part => part.type === type).value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

const dayMs = 86400000;
export const isoDay = date => date.toISOString().slice(0, 10);

// Monday through Sunday containing the given day.
export function weekBounds(today) {
  const weekday = (today.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(today.getTime() - weekday * dayMs);
  const end = new Date(start.getTime() + 6 * dayMs);
  return { start, end };
}

const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const label = date => `${date.getUTCDate()} ${SHORT[date.getUTCMonth()]}`;
export const weekLabel = ({ start, end }) => `${label(start)} to ${label(end)}`;

/* Parse "10 Sep", "Mon 8 Sep", "2026-09-10", "Today".
 * Returns a Date, or null when the text is prose rather than a date. */
export function parseDay(value, today = localToday()) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^today$/i.test(text)) return today;
  if (/^tomorrow$/i.test(text)) return new Date(today.getTime() + dayMs);

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));

  const written = text.match(/(?:^|\s)(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?/);
  if (!written) return null;
  const month = MONTHS[written[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;

  const year = written[3] ? Number(written[3]) : today.getUTCFullYear();
  let date = new Date(Date.UTC(year, month, Number(written[1])));
  // Undated years: a date far behind us almost always means next year.
  if (!written[3] && date.getTime() < today.getTime() - 180 * dayMs) date = new Date(Date.UTC(year + 1, month, Number(written[1])));
  return date;
}

/* Parse a phase window: "8 to 12 Sep", "10 to 30 Sep", "Today", "Rolling".
 * `kind` says why a window is missing, so the UI can distinguish continuous
 * work from work whose dates nobody has written down. */
export function parseWindow(value, today = localToday()) {
  const text = String(value || "").trim();
  if (!text) return { kind: "undated" };
  if (/^(rolling|weekly|ongoing|continuous)$/i.test(text)) return { kind: "continuous" };
  if (/^today$/i.test(text)) return { kind: "dated", start: today, end: today };

  const range = text.match(/(\d{1,2})(?:\s+([A-Za-z]{3,9}))?\s+to\s+(\d{1,2})\s+([A-Za-z]{3,9})/i);
  if (range) {
    const endMonth = range[4];
    const start = parseDay(`${range[1]} ${range[2] || endMonth}`, today);
    const end = parseDay(`${range[3]} ${endMonth}`, today);
    if (start && end) return { kind: "dated", start, end };
  }
  const single = parseDay(text, today);
  return single ? { kind: "dated", start: single, end: single } : { kind: "undated" };
}

const overlaps = (window, week) =>
  window.kind === "dated" && window.start <= week.end && window.end >= week.start;

const within = (date, week) => !!date && date >= week.start && date <= week.end;

/* Pull dated commitments out of a plan document's markdown tables.
 * Rows look like: | Business plan v1 draft | Capital | 15 Sep |
 * Only rows carrying a parseable date are returned; prose rows are ignored
 * here because the roadmap is the place undated work is tracked. */
export function milestonesFromPlan(text, today = localToday()) {
  const found = [];
  for (const line of String(text || "").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map(cell => cell.trim()).filter(Boolean);
    if (cells.length < 2 || /^-{2,}/.test(cells[0])) continue;
    const dateCell = cells.slice(1).reverse().find(cell => parseDay(cell, today));
    if (!dateCell) continue;
    const date = parseDay(dateCell, today);
    if (!date) continue;
    found.push({ title: cells[0], owner: cells.length > 2 ? cells[1] : null, due: date, dueLabel: dateCell });
  }
  return found;
}

const OWNERS = { K: "Kalena", P: "Paris", Both: "Kalena and Paris" };

export function buildThisWeek({ phases = [], roadmapState = {}, calendar = [], issues = [], memory = [], planText = "", now = new Date() }) {
  const today = localToday(now);
  const week = weekBounds(today);
  const done = roadmapState.done || {};
  const blockedState = roadmapState.blocked || {};
  const archived = roadmapState.archived || {};

  const live = phases.map(phase => ({ ...phase, window: parseWindow(phase.when, today) }));
  const active = live.filter(phase => overlaps(phase.window, week));
  const continuous = live.filter(phase => phase.window.kind === "continuous");

  const openTasks = live.flatMap(phase =>
    phase.tasks
      .filter(task => !done[task.id] && !archived[task.id])
      .map(task => ({
        ...task,
        phase: phase.name,
        ownerName: OWNERS[task.owner] || task.owner,
        dueDate: parseDay(task.due, today),
        blocked: !!blockedState[task.id],
      })),
  );

  const dueThisWeek = openTasks.filter(task => within(task.dueDate, week)).sort((a, b) => a.dueDate - b.dueDate);
  const overdue = openTasks.filter(task => task.dueDate && task.dueDate < week.start).sort((a, b) => a.dueDate - b.dueDate);
  const undated = openTasks.filter(task => !task.dueDate);
  const blocked = openTasks.filter(task => task.blocked);

  const shipping = calendar
    .filter(row => row.status !== "Archived")
    .map(row => ({ ...row, when: parseDay(row.date || row.day, today) }))
    .filter(row => within(row.when, week))
    .sort((a, b) => a.when - b.when || String(a.time || "").localeCompare(String(b.time || "")));

  const milestones = milestonesFromPlan(planText, today)
    .filter(item => within(item.due, week))
    .sort((a, b) => a.due - b.due);

  // Anything a person has to judge, gathered from wherever it was raised.
  const decisions = [
    ...issues.filter(item => ["open", "assigned"].includes(item.status)).map(item => ({
      kind: "signal", title: item.detail, where: item.source_location || item.mismatch_type, owner: item.assigned_to || null, id: `issue-${item.id}`,
    })),
    ...memory.filter(item => ["needs_decision", "conflict"].includes(item.status) && !item.archived_at).map(item => ({
      kind: item.status === "conflict" ? "conflict" : "decision", title: item.title, where: item.source_name || "Team entry", owner: null, id: `memory-${item.id}`,
    })),
  ];

  // The focus sentence. Derived from the dated plan, and honest when the
  // plan does not cover this week.
  let focus;
  if (active.length) {
    focus = {
      line: active.map(phase => phase.name).join(" and "),
      why: active[0].why || null,
      source: "Build roadmap, dated phases",
      windows: active.map(phase => phase.when),
    };
  } else if (milestones.length) {
    focus = { line: milestones[0].title, why: null, source: "Mission initiative plan", windows: [] };
  } else {
    focus = {
      line: null,
      why: null,
      source: null,
      windows: [],
      absent: "No dated phase or milestone covers this week. Add dates to the plan and this fills in by itself.",
    };
  }

  return {
    week: { start: isoDay(week.start), end: isoDay(week.end), label: weekLabel(week), today: isoDay(today) },
    focus,
    continuous: continuous.map(phase => ({ name: phase.name, when: phase.when })),
    shipping,
    dueThisWeek,
    overdue,
    blocked,
    milestones,
    decisions,
    counts: {
      shipping: shipping.length,
      due: dueThisWeek.length,
      overdue: overdue.length,
      blocked: blocked.length,
      decisions: decisions.length,
      undated: undated.length,
    },
  };
}
