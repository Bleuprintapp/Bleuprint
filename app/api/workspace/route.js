import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../lib/db";
import { getServerMember } from "../../../lib/server-member";
import { createMentionNotifications } from "../../../lib/passport-memory";

export const dynamic = "force-dynamic";
const WORKSPACE = "passport";
const ALLOWED_KEYS = new Set(["archive", "calendar", "campaigns", "contentSettings", "roadmap"]);

export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();
  const sql = getSql();
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
    const prior = await sql`SELECT state_value FROM bleuprint_workspace_state WHERE workspace_id=${WORKSPACE} AND state_key=${key} LIMIT 1`;
    const previousValue = prior[0]?.state_value;
    await sql`
      INSERT INTO bleuprint_workspace_state (workspace_id, state_key, state_value, updated_by)
      VALUES (${WORKSPACE}, ${key}, ${JSON.stringify(value)}::jsonb, ${member.email})
      ON CONFLICT (workspace_id, state_key) DO UPDATE SET
        state_value = EXCLUDED.state_value,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `;
    const detail = { count: Array.isArray(value) ? value.length : null };
    if (key === "calendar" && Array.isArray(value)) {
      const before = new Map((Array.isArray(previousValue) ? previousValue : []).map(row => [row.id, row]));
      detail.changes = value.map(row => {
        const old = before.get(row.id); if (!old) return { id: row.id, title: row.title, change: "created" };
        const fields = ["date", "time", "channel", "format", "title", "status"].filter(field => String(old[field] || "") !== String(row[field] || ""));
        return fields.length ? { id: row.id, title: row.title, previous: Object.fromEntries(fields.map(field => [field, old[field] || null])), next: Object.fromEntries(fields.map(field => [field, row[field] || null])) } : null;
      }).filter(Boolean).slice(0, 50);
    }
    await sql`
      INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, detail)
      VALUES (${WORKSPACE}, ${member.email}, ${"workspace." + key + ".updated"}, ${key}, ${JSON.stringify(detail)}::jsonb)
    `;
    await createMentionNotifications(sql, { actor:member.email, text:JSON.stringify(value), title:`${member.name} mentioned you in ${key}`, body:`A shared ${key} record was updated.`, link:`/admin?open=${key === "calendar" || key === "campaigns" ? "content" : key}` });
  }
  return NextResponse.json({ ok: true, updatedBy: member.email });
}
