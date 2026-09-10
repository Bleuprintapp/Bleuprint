import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";
import { ensureSchema, getSql } from "../../../lib/db";
import { createMentionNotifications } from "../../../lib/passport-memory";
import { sourceRoadmap } from "../../../lib/roadmap-source";

const WORKSPACE = "passport";
export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();
  const rows = await getSql()`SELECT state_value, updated_at, updated_by FROM bleuprint_workspace_state WHERE workspace_id = ${WORKSPACE} AND state_key = 'roadmap' LIMIT 1`;
  return NextResponse.json({ phases: await sourceRoadmap(), state: rows[0]?.state_value || { done: {}, blocked: {}, questions: {} }, updatedAt: rows[0]?.updated_at || null, updatedBy: rows[0]?.updated_by || null });
}

export async function POST(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await request.json().catch(() => null);
  if (!state || typeof state !== "object") return NextResponse.json({ error: "Roadmap state is required" }, { status: 400 });
  await ensureSchema();
  const sql = getSql();
  await sql`INSERT INTO bleuprint_workspace_state (workspace_id, state_key, state_value, updated_by) VALUES (${WORKSPACE}, 'roadmap', ${JSON.stringify(state)}::jsonb, ${member.email}) ON CONFLICT (workspace_id, state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`;
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, detail) VALUES (${WORKSPACE}, ${member.email}, 'roadmap.updated', 'Passport Build Roadmap', ${JSON.stringify({ completed: Object.values(state.done || {}).filter(Boolean).length, blocked: Object.keys(state.blocked || {}).length })}::jsonb)`;
  await createMentionNotifications(sql,{actor:member.email,text:JSON.stringify(state.questions||{}),title:`${member.name} mentioned you in the roadmap`,body:"A roadmap question or bottleneck needs your attention.",link:"/admin?open=roadmap"});
  return NextResponse.json({ ok: true, updatedBy: member.email });
}
