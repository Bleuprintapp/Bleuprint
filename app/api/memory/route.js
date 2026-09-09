import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../lib/db";
import { getServerMember } from "../../../lib/server-member";
import { createMentionNotifications } from "../../../lib/passport-memory";

const WORKSPACE = "passport";
const AREAS = new Set(["Brand", "Audience", "Content", "Roadmap", "Opportunities", "Performance", "Reference"]);
const STATUSES = new Set(["extracted", "confirmed", "suggested", "conflict", "needs_decision", "archived", "superseded"]);

const selectEntries = sql => sql`
  SELECT id, area, entry_type, status, title, body, source_document_id, source_name, source_location,
    evidence, created_by, updated_by, created_at, updated_at
  FROM bleuprint_memory_entries
  WHERE workspace_id = ${WORKSPACE} AND archived_at IS NULL
  ORDER BY CASE status WHEN 'conflict' THEN 0 WHEN 'needs_decision' THEN 1 WHEN 'suggested' THEN 2 ELSE 3 END, updated_at DESC
`;

export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();
  return NextResponse.json({ entries: await selectEntries(getSql()) });
}

export async function POST(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const area = AREAS.has(body.area) ? body.area : "Reference";
  const title = String(body.title || "").trim();
  const value = String(body.body || "").trim();
  if (!title || !value) return NextResponse.json({ error: "Title and memory are required" }, { status: 400 });
  await ensureSchema(); const sql = getSql();
  const inserted = await sql`
    INSERT INTO bleuprint_memory_entries (workspace_id, area, entry_type, status, title, body, source_name, source_location, evidence, created_by, updated_by)
    VALUES (${WORKSPACE}, ${area}, ${body.entryType || "decision"}, ${body.status === "suggested" ? "suggested" : "confirmed"}, ${title.slice(0,180)}, ${value.slice(0,5000)}, 'Team entry', ${`Entered in ${area}`}, ${value.slice(0,500)}, ${member.email}, ${member.email})
    RETURNING id
  `;
  await createMentionNotifications(sql, { actor:member.email, text:value, title:`${member.name} mentioned you in ${area}`, body:`${title}: ${value.slice(0,240)}`, link:"/admin?open=memory" });
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, source_location, detail) VALUES (${WORKSPACE}, ${member.email}, 'memory.created', ${title}, ${area}, ${JSON.stringify({ id:inserted[0].id, area })}::jsonb)`;
  return NextResponse.json({ entries: await selectEntries(sql) });
}

export async function PATCH(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "Memory id is required" }, { status: 400 });
  await ensureSchema(); const sql = getSql();
  const found = await sql`SELECT * FROM bleuprint_memory_entries WHERE id = ${body.id} AND workspace_id = ${WORKSPACE} LIMIT 1`;
  if (!found.length) return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  const current = found[0];
  if (body.action === "archive") {
    await sql`UPDATE bleuprint_memory_entries SET status = 'archived', archived_at = NOW(), archived_by = ${member.email}, updated_at = NOW(), updated_by = ${member.email} WHERE id = ${body.id}`;
  } else {
    const area = AREAS.has(body.area) ? body.area : current.area;
    const status = STATUSES.has(body.status) && body.status !== "archived" ? body.status : current.status;
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0,180) : current.title;
    const value = typeof body.body === "string" && body.body.trim() ? body.body.trim().slice(0,5000) : current.body;
    await sql`UPDATE bleuprint_memory_entries SET area=${area}, status=${status}, title=${title}, body=${value}, updated_at=NOW(), updated_by=${member.email} WHERE id=${body.id}`;
    await createMentionNotifications(sql, { actor:member.email, text:value, title:`${member.name} mentioned you in ${area}`, body:`${title}: ${value.slice(0,240)}`, link:"/admin?open=memory" });
  }
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, source_location, detail) VALUES (${WORKSPACE}, ${member.email}, ${body.action === "archive" ? "memory.archived" : "memory.updated"}, ${current.title}, ${current.area}, ${JSON.stringify({ id:body.id, previous:{ area:current.area, status:current.status, title:current.title, body:current.body }, action:body.action || "edit" })}::jsonb)`;
  return NextResponse.json({ entries: await selectEntries(sql) });
}
