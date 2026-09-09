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
    await createMentionNotifications(sql, { actor:member.email, text:JSON.stringify(value), title:`${member.name} mentioned you in ${key}`, body:`A shared ${key} record was updated.`, link:`/admin?open=${key === "calendar" || key === "campaigns" ? "content" : key}` });
  }
  return NextResponse.json({ ok: true, updatedBy: member.email });
}
