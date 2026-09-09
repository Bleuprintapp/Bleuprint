import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";
import { ensureSchema, getSql } from "../../../lib/db";
import { calendarRowsFromUpload, SOURCE_ASSUMPTION_POLICY } from "../../../lib/passport-content";

export const runtime = "nodejs";
const WORKSPACE = "passport";
const readable = new Set(["text/plain","text/html","text/markdown","text/csv","application/json"]);
const rows = sql => sql`SELECT id, name, pathname, content_type, size_bytes, extraction_state, document_type, destination, context, is_record, uploaded_by, uploaded_at FROM bleuprint_documents WHERE workspace_id = ${WORKSPACE} ORDER BY uploaded_at DESC`;
const mismatchRows = sql => sql`SELECT m.id, m.document_id, m.mismatch_type, m.detail, m.source_location, m.status, m.created_at, d.name AS document_name, r.name AS record_name FROM bleuprint_mismatches m JOIN bleuprint_documents d ON d.id = m.document_id LEFT JOIN bleuprint_documents r ON r.id = m.record_document_id WHERE m.workspace_id = ${WORKSPACE} AND m.status = 'open' ORDER BY m.created_at DESC`;
const bundledSources = [
  { name: "brand-guide.html", type: "brand foundation", destination: "Brand memory", record: true },
  { name: "roadmap.html", type: "roadmap", destination: "Planning", record: true },
  { name: "week-one.html", type: "content plan", destination: "Content system", record: true },
  { name: "index.html", type: "reference", destination: "Passport index", record: false },
];
function classify(name, text = "") {
  const filename = name.toLowerCase();
  const sample = `${name} ${text.slice(0, 20000)}`.toLowerCase();
  if (/drift|mismatch|alignment[\s_-]*report/.test(filename)) return ["alignment audit", "Attention signals"];
  if (/file[\s_-]*registry|source[\s_-]*registry/.test(filename)) return ["source registry", "Source registry"];
  if (/roadmap|build[\s_-]*plan|launch[\s_-]*plan/.test(filename)) return ["roadmap", "Planning"];
  if (/tracker|milestone|timeline/.test(filename)) return ["tracker", "Planning"];
  if (/content[\s_-]*calendar|week[\s_-]*one|posting[\s_-]*schedule/.test(filename)) return ["content plan", "Content system"];
  if (/operating[\s_-]*system|workflow/.test(filename)) return ["operating system", "Planning"];
  if (/brand[\s_-]*guide|brand[\s_-]*strategy|mission|vision|canonical[\s_-]*context/.test(filename)) return ["brand foundation", "Brand memory"];
  if (/brand guide|brand strategy|voice|positioning|mission|vision/.test(sample)) return ["brand foundation", "Brand memory"];
  if (/content calendar|week one|posting schedule|instagram|tiktok|linkedin/.test(sample)) return ["content plan", "Content system"];
  if (/roadmap|milestone|launch plan|timeline/.test(sample)) return ["roadmap", "Planning"];
  if (/campaign|creative brief|caption|script/.test(sample)) return ["campaign", "Campaign workspace"];
  if (/\.(png|jpe?g|webp|gif|mp4|mov)$/i.test(name)) return ["asset", "Asset library"];
  return ["reference", "Source inbox"];
}
function deriveContext(text = "") {
  const headings = [...text.matchAll(/(?:^|[.!?]\s+)([A-Z][A-Za-z0-9 &/—-]{3,70})(?=[:\n])/gm)].slice(0,12).map(x=>x[1]);
  return { summary: text.slice(0, 700), dates: [...new Set(text.match(/\b(?:20\d{2}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2})\b/gi) || [])].slice(0,20), colors: [...new Set(text.match(/#[0-9a-f]{6}\b/gi) || [])], headings, assumption_policy: SOURCE_ASSUMPTION_POLICY };
}

async function ensureBundledSources(sql) {
  for (const source of bundledSources) {
    const raw = await readFile(new URL(`../../../public/hq/passport/${source.name}`, import.meta.url), "utf8");
    const visible = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    const calendar = source.name === "week-one.html" ? calendarRowsFromUpload({ name: source.name, contentType: "text/html", rawText: raw }) : [];
    const extracted = source.name === "roadmap.html" ? raw.slice(0, 500000) : [visible, calendar.map(row => [row.date, row.channel, row.title, row.productionFormat || row.format, row.brief, row.screen, row.copy?.a, row.copy?.b].filter(Boolean).join(" · ")).join("\n")].filter(Boolean).join("\n").slice(0, 500000);
    const summary = source.name === "roadmap.html"
      ? "Passport Build Roadmap. Thirty-five tasks across five ordered phases with owners, timing, dependencies, and flagged decisions."
      : source.name === "week-one.html"
        ? `Passport Week One content plan. ${calendar.length} scheduled expressions across LinkedIn, Instagram, and TikTok, with briefs, proof labels, source assets, and approved copy variants.`
        : visible.slice(0, 700);
    const context = { ...deriveContext(extracted), summary, source: "Published Passport file already included with this portal", assumption_policy: SOURCE_ASSUMPTION_POLICY };
    await sql`
      INSERT INTO bleuprint_documents (workspace_id, name, pathname, content_type, size_bytes, extracted_text, extraction_state, document_type, destination, context, is_record, uploaded_by)
      VALUES (${WORKSPACE}, ${source.name}, ${`db://passport/bundled/${source.name}`}, 'text/html', ${Buffer.byteLength(raw)}, ${extracted}, 'connected from published Passport source', ${source.type}, ${source.destination}, ${JSON.stringify(context)}::jsonb, ${source.record}, 'Passport source')
      ON CONFLICT (pathname) DO NOTHING
    `;
  }
}

async function seedCalendarIfEmpty(sql, calendar, member, sourceName, pathname) {
  if (!calendar.length) return { status: "not_applicable", count: 0 };
  const result = await sql`
    INSERT INTO bleuprint_workspace_state (workspace_id, state_key, state_value, updated_by)
    VALUES (${WORKSPACE}, 'calendar', ${JSON.stringify(calendar)}::jsonb, ${member.email})
    ON CONFLICT (workspace_id, state_key) DO UPDATE SET
      state_value = EXCLUDED.state_value,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    WHERE CASE
      WHEN jsonb_typeof(bleuprint_workspace_state.state_value) = 'array'
      THEN jsonb_array_length(bleuprint_workspace_state.state_value) = 0
      ELSE TRUE
    END
    RETURNING state_key
  `;
  if (!result.length) return { status: "kept_existing", count: 0 };
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, source_location, detail) VALUES (${WORKSPACE}, ${member.email}, 'workspace.calendar.seeded', ${sourceName}, ${pathname}, ${JSON.stringify({ count: calendar.length, policy: "Only an empty shared calendar may be initialized by a source upload." })}::jsonb)`;
  return { status: "seeded", count: calendar.length };
}

export async function GET() {
  const member = await getServerMember(); if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema(); const sql = getSql(); await ensureBundledSources(sql); return NextResponse.json({ documents: await rows(sql), mismatches: await mismatchRows(sql) });
}

export async function POST(request) {
  const member = await getServerMember(); if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "Choose a file smaller than 25 MB" }, { status: 400 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const canIndex = readable.has(file.type) || /\.(txt|md|html?|csv|json)$/i.test(file.name);
  const rawText = canIndex ? await file.text() : null;
  const calendar = canIndex ? calendarRowsFromUpload({ name: file.name, contentType: file.type, rawText }) : [];
  const calendarText = calendar.map(row => [row.date || row.day, row.channel, row.title, row.productionFormat || row.format, row.pillar, row.proof, row.brief, row.screen, row.copy?.a, row.copy?.b, row.sourceAsset].filter(Boolean).join(" · ")).join("\n");
  const visibleText = canIndex ? rawText.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  const text = canIndex ? [visibleText, calendarText].filter(Boolean).join("\n").slice(0, 500000) : null;
  let pathname, storage = "vercel_blob", storageDetail = null;
  let state = canIndex ? "stored + indexed" : "stored · awaiting text extraction";
  try {
    const blob = await put(`passport/sources/${Date.now()}-${safeName}`, file, { access: "private", addRandomSuffix: true });
    pathname = blob.pathname;
  } catch (error) {
    if (!canIndex) return NextResponse.json({ error: "File storage is unavailable, so this binary file cannot be saved yet. Try again after Vercel Blob is connected.", detail: error.message }, { status: 503 });
    pathname = `db://passport/sources/${Date.now()}-${randomUUID()}-${safeName}`;
    storage = "database_only";
    storageDetail = error.message;
    state = "indexed · database only";
  }
  const [documentType, destination] = classify(file.name, text || ""); const context = deriveContext(text || "");
  await ensureSchema(); const sql = getSql();
  const inserted = await sql`INSERT INTO bleuprint_documents (workspace_id, name, pathname, content_type, size_bytes, extracted_text, extraction_state, document_type, destination, context, uploaded_by) VALUES (${WORKSPACE}, ${file.name}, ${pathname}, ${file.type}, ${file.size}, ${text}, ${state}, ${documentType}, ${destination}, ${JSON.stringify(context)}::jsonb, ${member.email}) RETURNING id`;
  const documentId = inserted[0].id; const records = await sql`SELECT id, name, context FROM bleuprint_documents WHERE workspace_id = ${WORKSPACE} AND document_type = ${documentType} AND is_record = TRUE ORDER BY uploaded_at DESC LIMIT 1`;
  if (!records.length) await sql`INSERT INTO bleuprint_mismatches (workspace_id, document_id, mismatch_type, detail, source_location) VALUES (${WORKSPACE}, ${documentId}, 'authority_unset', 'No document of record has been selected for this source category.', ${destination})`;
  else {
    const record = records[0]; const previous = record.context || {}; const changedColors = [...new Set([...(context.colors || []), ...(previous.colors || [])])].filter(x => !(context.colors || []).includes(x) || !(previous.colors || []).includes(x));
    if (changedColors.length) await sql`INSERT INTO bleuprint_mismatches (workspace_id, document_id, record_document_id, mismatch_type, detail, source_location) VALUES (${WORKSPACE}, ${documentId}, ${record.id}, 'explicit_value_change', ${`Color values differ from ${record.name}: ${changedColors.join(', ')}`}, 'Extracted color values')`;
  }
  const calendarImport = await seedCalendarIfEmpty(sql, calendar, member, file.name, pathname);
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, source_location, detail) VALUES (${WORKSPACE}, ${member.email}, 'source.uploaded', ${file.name}, ${pathname}, ${JSON.stringify({ size: file.size, extraction: state, storage, storageDetail, calendarImport })}::jsonb)`;
  return NextResponse.json({ documents: await rows(sql), mismatches: await mismatchRows(sql), calendarImport, storage });
}

export async function PATCH(request) {
  const member = await getServerMember(); if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { id } = body;
  const summary = typeof body.summary === "string" ? body.summary : typeof body.context?.summary === "string" ? body.context.summary : undefined;
  const destination = typeof body.destination === "string" ? body.destination.trim() : undefined;
  const documentType = typeof body.document_type === "string" ? body.document_type.trim() : undefined;
  if (!id) return NextResponse.json({ error: "Source id is required" }, { status: 400 });
  if (summary !== undefined && summary.length > 5000) return NextResponse.json({ error: "Summary must be 5,000 characters or fewer" }, { status: 400 });
  if (destination !== undefined && (!destination || destination.length > 100)) return NextResponse.json({ error: "Destination must be between 1 and 100 characters" }, { status: 400 });
  if (documentType !== undefined && (!documentType || documentType.length > 100)) return NextResponse.json({ error: "Document type must be between 1 and 100 characters" }, { status: 400 });
  const hasEdits = summary !== undefined || destination !== undefined || documentType !== undefined;
  const shouldMarkRecord = body.markRecord === true || (!hasEdits && body.markRecord !== false);
  if (!hasEdits && !shouldMarkRecord) return NextResponse.json({ error: "No supported source update supplied" }, { status: 400 });
  await ensureSchema(); const sql = getSql();
  const docs = await sql`SELECT id, name, document_type, destination, context, is_record FROM bleuprint_documents WHERE id = ${id} AND workspace_id = ${WORKSPACE} LIMIT 1`; if (!docs.length) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  const doc = docs[0];
  const nextContext = summary === undefined ? doc.context : { ...(doc.context || {}), summary, assumption_policy: doc.context?.assumption_policy || SOURCE_ASSUMPTION_POLICY };
  const nextDestination = destination ?? doc.destination;
  const nextDocumentType = documentType ?? doc.document_type;
  if (hasEdits) await sql`UPDATE bleuprint_documents SET context = ${JSON.stringify(nextContext)}::jsonb, destination = ${nextDestination}, document_type = ${nextDocumentType} WHERE id = ${id}`;
  if (doc.is_record && nextDocumentType !== doc.document_type) await sql`UPDATE bleuprint_documents SET is_record = FALSE WHERE workspace_id = ${WORKSPACE} AND document_type = ${nextDocumentType} AND id <> ${id}`;
  if (shouldMarkRecord) {
    await sql`UPDATE bleuprint_documents SET is_record = FALSE WHERE workspace_id = ${WORKSPACE} AND document_type = ${nextDocumentType}`;
    await sql`UPDATE bleuprint_documents SET is_record = TRUE WHERE id = ${id}`;
    await sql`UPDATE bleuprint_mismatches SET status = 'resolved' WHERE document_id = ${id} AND mismatch_type = 'authority_unset'`;
  }
  const eventType = shouldMarkRecord ? 'source.marked_record' : 'source.updated';
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, detail) VALUES (${WORKSPACE}, ${member.email}, ${eventType}, ${doc.name}, ${JSON.stringify({ id, summaryChanged: summary !== undefined, destination: nextDestination, documentType: nextDocumentType, isRecord: shouldMarkRecord || doc.is_record })}::jsonb)`;
  return NextResponse.json({ documents: await rows(sql), mismatches: await mismatchRows(sql) });
}
