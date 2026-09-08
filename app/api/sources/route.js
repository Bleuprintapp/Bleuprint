import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";
import { ensureSchema, getSql } from "../../../lib/db";

export const runtime = "nodejs";
const WORKSPACE = "passport";
const readable = new Set(["text/plain","text/html","text/markdown","text/csv","application/json"]);
const rows = sql => sql`SELECT id, name, pathname, content_type, size_bytes, extraction_state, document_type, destination, context, is_record, uploaded_by, uploaded_at FROM bleuprint_documents WHERE workspace_id = ${WORKSPACE} ORDER BY uploaded_at DESC`;
const mismatchRows = sql => sql`SELECT m.id, m.document_id, m.mismatch_type, m.detail, m.source_location, m.status, m.created_at, d.name AS document_name, r.name AS record_name FROM bleuprint_mismatches m JOIN bleuprint_documents d ON d.id = m.document_id LEFT JOIN bleuprint_documents r ON r.id = m.record_document_id WHERE m.workspace_id = ${WORKSPACE} AND m.status = 'open' ORDER BY m.created_at DESC`;
function classify(name, text = "") {
  const sample = `${name} ${text.slice(0, 20000)}`.toLowerCase();
  if (/brand guide|brand strategy|voice|positioning|mission|vision/.test(sample)) return ["brand foundation", "Brand memory"];
  if (/content calendar|week one|posting schedule|instagram|tiktok|linkedin/.test(sample)) return ["content plan", "Content system"];
  if (/roadmap|milestone|launch plan|timeline/.test(sample)) return ["roadmap", "Planning"];
  if (/campaign|creative brief|caption|script/.test(sample)) return ["campaign", "Campaign workspace"];
  if (/\.(png|jpe?g|webp|gif|mp4|mov)$/i.test(name)) return ["asset", "Asset library"];
  return ["reference", "Source inbox"];
}
function deriveContext(text = "") {
  const headings = [...text.matchAll(/(?:^|[.!?]\s+)([A-Z][A-Za-z0-9 &/—-]{3,70})(?=[:\n])/gm)].slice(0,12).map(x=>x[1]);
  return { summary: text.slice(0, 700), dates: [...new Set(text.match(/\b(?:20\d{2}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2})\b/gi) || [])].slice(0,20), colors: [...new Set(text.match(/#[0-9a-f]{6}\b/gi) || [])], headings, assumption_policy: "Extract explicit text only. Do not infer authority, status, ownership, dates, or intent. Human review required before a source becomes a document of record." };
}

export async function GET() {
  const member = await getServerMember(); if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema(); const sql = getSql(); return NextResponse.json({ documents: await rows(sql), mismatches: await mismatchRows(sql) });
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
  const [documentType, destination] = classify(file.name, text || ""); const context = deriveContext(text || "");
  await ensureSchema(); const sql = getSql();
  const inserted = await sql`INSERT INTO bleuprint_documents (workspace_id, name, pathname, content_type, size_bytes, extracted_text, extraction_state, document_type, destination, context, uploaded_by) VALUES (${WORKSPACE}, ${file.name}, ${blob.pathname}, ${file.type}, ${file.size}, ${text}, ${state}, ${documentType}, ${destination}, ${JSON.stringify(context)}::jsonb, ${member.email}) RETURNING id`;
  const documentId = inserted[0].id; const records = await sql`SELECT id, name, context FROM bleuprint_documents WHERE workspace_id = ${WORKSPACE} AND document_type = ${documentType} AND is_record = TRUE ORDER BY uploaded_at DESC LIMIT 1`;
  if (!records.length) await sql`INSERT INTO bleuprint_mismatches (workspace_id, document_id, mismatch_type, detail, source_location) VALUES (${WORKSPACE}, ${documentId}, 'authority_unset', 'No document of record has been selected for this source category.', ${destination})`;
  else {
    const record = records[0]; const previous = record.context || {}; const changedColors = [...new Set([...(context.colors || []), ...(previous.colors || [])])].filter(x => !(context.colors || []).includes(x) || !(previous.colors || []).includes(x));
    if (changedColors.length) await sql`INSERT INTO bleuprint_mismatches (workspace_id, document_id, record_document_id, mismatch_type, detail, source_location) VALUES (${WORKSPACE}, ${documentId}, ${record.id}, 'explicit_value_change', ${`Color values differ from ${record.name}: ${changedColors.join(', ')}`}, 'Extracted color values')`;
  }
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, source_location, detail) VALUES (${WORKSPACE}, ${member.email}, 'source.uploaded', ${file.name}, ${blob.pathname}, ${JSON.stringify({ size: file.size, extraction: state })}::jsonb)`;
  return NextResponse.json({ documents: await rows(sql), mismatches: await mismatchRows(sql) });
}

export async function PATCH(request) {
  const member = await getServerMember(); if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json().catch(() => ({})); await ensureSchema(); const sql = getSql();
  const docs = await sql`SELECT id, document_type FROM bleuprint_documents WHERE id = ${id} AND workspace_id = ${WORKSPACE} LIMIT 1`; if (!docs.length) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  await sql`UPDATE bleuprint_documents SET is_record = FALSE WHERE workspace_id = ${WORKSPACE} AND document_type = ${docs[0].document_type}`;
  await sql`UPDATE bleuprint_documents SET is_record = TRUE WHERE id = ${id}`;
  await sql`UPDATE bleuprint_mismatches SET status = 'resolved' WHERE document_id = ${id} AND mismatch_type = 'authority_unset'`;
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, detail) SELECT ${WORKSPACE}, ${member.email}, 'source.marked_record', name, ${JSON.stringify({ id })}::jsonb FROM bleuprint_documents WHERE id = ${id}`;
  return NextResponse.json({ documents: await rows(sql), mismatches: await mismatchRows(sql) });
}
