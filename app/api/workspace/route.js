import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../lib/db";
import { getServerMember } from "../../../lib/server-member";
import { PASSPORT_WEEK_ONE_CALENDAR } from "../../../lib/passport-content";

export const dynamic = "force-dynamic";
const WORKSPACE = "passport";
const ALLOWED_KEYS = new Set(["archive", "calendar", "campaigns", "contentSettings", "roadmap"]);

export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();
  const sql = getSql();
  const existingCalendar = await sql`SELECT state_value FROM bleuprint_workspace_state WHERE workspace_id = ${WORKSPACE} AND state_key = 'calendar' LIMIT 1`;
  const currentCalendar = Array.isArray(existingCalendar[0]?.state_value) ? existingCalendar[0].state_value : [];
  const currentById = new Map(currentCalendar.filter(row => row?.id).map(row => [row.id, row]));
  const canonicalIds = new Set(PASSPORT_WEEK_ONE_CALENDAR.map(row => row.id));
  const mergedCalendar = [
    ...PASSPORT_WEEK_ONE_CALENDAR.map(row => currentById.get(row.id) || row),
    ...currentCalendar.filter(row => !canonicalIds.has(row?.id)),
  ];
  const added = mergedCalendar.length - currentCalendar.length;
  if (!existingCalendar.length || added > 0) {
    await sql`
      INSERT INTO bleuprint_workspace_state (workspace_id, state_key, state_value, updated_by)
      VALUES (${WORKSPACE}, 'calendar', ${JSON.stringify(mergedCalendar)}::jsonb, 'Passport Week One source')
      ON CONFLICT (workspace_id, state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
    `;
    await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, source_location, detail) VALUES (${WORKSPACE}, ${member.email}, 'workspace.calendar.connected', 'week-one.html', '/hq/passport/week-one.html', ${JSON.stringify({ added, preserved: currentCalendar.length })}::jsonb)`;
  }
  const rows = await sql`
    SELECT state_key, state_value, updated_at, updated_by
    FROM bleuprint_workspace_state WHERE workspace_id = ${WORKSPACE}
  `;
  return NextResponse.json({ member, state: Object.fromEntries(rows.map(row => [row.state_key, row.state_value])), records: rows });
}

export async function POST(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const entries = Object.entries(body?.state || {}).filter(([key]) => ALLOWED_KEYS.has(key));
  if (!entries.length) return NextResponse.json({ error: "No supported state supplied" }, { status: 400 });
  await ensureSchema();
  const sql = getSql();
  for (const [key, value] of entries) {
    await sql`
      INSERT INTO bleuprint_workspace_state (workspace_id, state_key, state_value, updated_by)
      VALUES (${WORKSPACE}, ${key}, ${JSON.stringify(value)}::jsonb, ${member.email})
      ON CONFLICT (workspace_id, state_key) DO UPDATE SET
        state_value = EXCLUDED.state_value,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `;
    await sql`
      INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, detail)
      VALUES (${WORKSPACE}, ${member.email}, ${"workspace." + key + ".updated"}, ${key}, ${JSON.stringify({ count: Array.isArray(value) ? value.length : null })}::jsonb)
    `;
  }
  return NextResponse.json({ ok: true, updatedBy: member.email });
}
