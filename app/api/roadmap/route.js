import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";
import { ensureSchema, getSql } from "../../../lib/db";
import { createMentionNotifications } from "../../../lib/passport-memory";

const WORKSPACE = "passport";
const decode = value => String(value || "").replace(/\\"/g, '"').replace(/\\n/g, "\n");

async function sourceRoadmap() {
  const html = await readFile(new URL("../../../public/hq/passport/roadmap.html", import.meta.url), "utf8");
  const block = html.match(/var PHASES = \[([\s\S]*?)\n  \];/)?.[1] || "";
  const phases = [];
  const phasePattern = /\{ id:"([^"]+)", num:"([^"]+)", name:"((?:\\.|[^"])*)", when:"((?:\\.|[^"])*)", why:"((?:\\.|[^"])*)",\s*tasks:\[([\s\S]*?)\]\s*\}/g;
  for (const match of block.matchAll(phasePattern)) {
    const tasks = [];
    const taskPattern = /\{id:"([^"]+)", t:"((?:\\.|[^"])*)", d:"((?:\\.|[^"])*)", o:"([^"]+)", due:"((?:\\.|[^"])*)"(?:, flag:true)?\}/g;
    for (const task of match[6].matchAll(taskPattern)) tasks.push({ id: task[1], title: decode(task[2]), detail: decode(task[3]), owner: task[4], due: decode(task[5]), key: /flag:true/.test(task[0]) });
    phases.push({ id: match[1], number: match[2], name: decode(match[3]), when: decode(match[4]), why: decode(match[5]), tasks });
  }
  return phases;
}

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
