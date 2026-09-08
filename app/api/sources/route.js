import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";
import { ensureSchema, getSql } from "../../../lib/db";

export const runtime = "nodejs";
const WORKSPACE = "passport";
const readable = new Set(["text/plain","text/html","text/markdown","text/csv","application/json"]);
const rows = sql => sql`SELECT name, pathname, content_type, size_bytes, extraction_state, uploaded_by, uploaded_at FROM bleuprint_documents WHERE workspace_id = ${WORKSPACE} ORDER BY uploaded_at DESC`;

export async function GET() {
  const member = await getServerMember(); if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema(); return NextResponse.json({ documents: await rows(getSql()) });
}

export async function POST(request) {
  const member = await getServerMember(); if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "Choose a file smaller than 25 MB" }, { status: 400 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  let blob;
  try { blob = await put(`passport/sources/${Date.now()}-${safeName}`, file, { access: "private", addRandomSuffix: true }); }
  catch (error) { return NextResponse.json({ error: "Vercel file storage is attached but its upload token is not available to this deployment yet.", detail: error.message }, { status: 503 }); }
  let text = null, state = "stored · awaiting text extraction";
  if (readable.has(file.type) || /\.(txt|md|html?|csv|json)$/i.test(file.name)) { text = (await file.text()).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500000); state = "stored + indexed"; }
  await ensureSchema(); const sql = getSql();
  await sql`INSERT INTO bleuprint_documents (workspace_id, name, pathname, content_type, size_bytes, extracted_text, extraction_state, uploaded_by) VALUES (${WORKSPACE}, ${file.name}, ${blob.pathname}, ${file.type}, ${file.size}, ${text}, ${state}, ${member.email})`;
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, source_location, detail) VALUES (${WORKSPACE}, ${member.email}, 'source.uploaded', ${file.name}, ${blob.pathname}, ${JSON.stringify({ size: file.size, extraction: state })}::jsonb)`;
  return NextResponse.json({ documents: await rows(sql) });
}
