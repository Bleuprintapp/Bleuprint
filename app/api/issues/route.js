import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../lib/db";
import { getServerMember } from "../../../lib/server-member";
import { createMentionNotifications } from "../../../lib/passport-memory";

const WORKSPACE = "passport";
const issueRows = sql => sql`
  SELECT m.id, m.document_id, m.mismatch_type, m.detail, m.source_location, m.status, m.created_at,
    m.resolution_note, m.resolved_by, m.resolved_at, m.assigned_to, m.impact,
    d.name AS document_name, r.name AS record_name
  FROM bleuprint_mismatches m
  LEFT JOIN bleuprint_documents d ON d.id=m.document_id
  LEFT JOIN bleuprint_documents r ON r.id=m.record_document_id
  WHERE m.workspace_id=${WORKSPACE} AND m.status <> 'archived'
  ORDER BY CASE m.status WHEN 'open' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END, m.created_at DESC
`;

export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  await ensureSchema(); return NextResponse.json({ issues:await issueRows(getSql()) });
}

export async function POST(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const body = await request.json().catch(() => ({}));
  if (!body.detail) return NextResponse.json({ error:"Issue detail is required" }, { status:400 });
  await ensureSchema(); const sql=getSql();
  await sql`INSERT INTO bleuprint_mismatches (workspace_id, mismatch_type, detail, source_location, assigned_to, impact) VALUES (${WORKSPACE}, ${body.type || "team_flag"}, ${String(body.detail).slice(0,3000)}, ${body.location || "Team review"}, ${body.assignedTo || null}, ${JSON.stringify(body.impact || {})}::jsonb)`;
  await createMentionNotifications(sql,{actor:member.email,text:`${body.detail} ${body.assignedTo || ""}`,title:`${member.name} flagged an issue`,body:String(body.detail).slice(0,300),link:"/admin?open=issues"});
  return NextResponse.json({ issues:await issueRows(sql) });
}

export async function PATCH(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const body = await request.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error:"Issue id is required" }, { status:400 });
  const allowed=new Set(["open","assigned","resolved","dismissed","archived"]);
  const status=allowed.has(body.status) ? body.status : null;
  if(!status) return NextResponse.json({error:"Choose a supported issue status"},{status:400});
  await ensureSchema(); const sql=getSql();
  const found=await sql`SELECT * FROM bleuprint_mismatches WHERE id=${body.id} AND workspace_id=${WORKSPACE} LIMIT 1`;
  if(!found.length)return NextResponse.json({error:"Issue not found"},{status:404});
  const issue=found[0]; const note=typeof body.resolutionNote === "string" ? body.resolutionNote.slice(0,3000) : null;
  const assignedTo=body.assignedTo || issue.assigned_to || null;
  const impact=body.impact && typeof body.impact === "object" ? body.impact : issue.impact || {};
  await sql`UPDATE bleuprint_mismatches SET status=${status}, resolution_note=${note}, assigned_to=${assignedTo}, impact=${JSON.stringify(impact)}::jsonb, resolved_by=${["resolved","dismissed"].includes(status)?member.email:null}, resolved_at=${["resolved","dismissed"].includes(status)?new Date().toISOString():null} WHERE id=${body.id}`;
  if(body.applyImpact === true && impact.area && impact.summary) {
    await sql`INSERT INTO bleuprint_memory_entries (workspace_id, area, entry_type, status, title, body, source_document_id, source_name, source_location, evidence, created_by, updated_by) VALUES (${WORKSPACE}, ${impact.area}, 'decision', 'confirmed', ${impact.title || `Resolution: ${issue.detail.slice(0,80)}`}, ${impact.summary}, ${issue.document_id}, ${issue.document_id ? "Resolved source issue" : "Team resolution"}, ${issue.source_location || "Issue resolution"}, ${note || impact.summary}, ${member.email}, ${member.email})`;
  }
  await createMentionNotifications(sql,{actor:member.email,text:`${note || ""} ${assignedTo || ""}`,title:`${member.name} updated an issue`,body:`${issue.detail.slice(0,180)} · ${status}`,link:"/admin?open=issues"});
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, source_location, detail) VALUES (${WORKSPACE}, ${member.email}, ${`issue.${status}`}, ${issue.document_id ? "Source issue" : "Team issue"}, ${issue.source_location}, ${JSON.stringify({id:body.id,previous:issue.status,status,note,assignedTo,impact,appliedToMemory:body.applyImpact===true})}::jsonb)`;
  return NextResponse.json({ issues:await issueRows(sql) });
}
