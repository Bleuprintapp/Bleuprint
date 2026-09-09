import { readFile } from "node:fs/promises";

const envText = await readFile(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

const { ensureSchema, getSql } = await import("../lib/db.js");
const { extractMemoryEntries } = await import("../lib/passport-memory.js");
const { PASSPORT_WEEK_ONE_CALENDAR } = await import("../lib/passport-content.js");

const workspace = "passport";
const actor = "kgardner@discoverultrium.com";
const archiveKey = "archive_snapshot_demo_2026_09_09";
const selectedSources = [
  { path:"/Users/gardner/Desktop/Passport/00_Canonical/PASSPORT_CANONICAL_CONTEXT.md", name:"PASSPORT_CANONICAL_CONTEXT.md", type:"brand foundation", destination:"Brand + audience memory", record:true },
  { path:"/Users/gardner/Desktop/Passport/01_Brand/PASSPORT_BRAND_GUIDE_v1_2026-09-07.html", name:"PASSPORT_BRAND_GUIDE_v1_2026-09-07.html", type:"visual brand guide", destination:"Brand memory", record:false },
  { path:"/Users/gardner/Desktop/Passport/00_Canonical/PASSPORT_MISSION_INITIATIVE_PLAN.md", name:"PASSPORT_MISSION_INITIATIVE_PLAN.md", type:"business strategy", destination:"Roadmap + opportunities", record:true },
  { path:"/Users/gardner/Desktop/Passport/00_Canonical/PASSPORT_BUILD_ROADMAP_v2_2026-09-08.md", name:"PASSPORT_BUILD_ROADMAP_v2_2026-09-08.md", type:"roadmap", destination:"Roadmap", record:true },
  { path:"/Users/gardner/Desktop/Passport/02_Content/PASSPORT_LAUNCH_WEEK_PLAN_v1_2026-09-07.md", name:"PASSPORT_LAUNCH_WEEK_PLAN_v1_2026-09-07.md", type:"content production", destination:"Content", record:false },
  { path:"/Users/gardner/Desktop/Passport/02_Content/week-2026-09-07/CAPTIONS.md", name:"CAPTIONS.md", type:"caption library", destination:"Content", record:false },
];

function visibleText(raw) {
  return raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

await ensureSchema();
const sql = getSql();
const priorState = await sql`SELECT state_key, state_value, updated_at, updated_by FROM bleuprint_workspace_state WHERE workspace_id=${workspace} AND state_key <> ${archiveKey}`;
const snapshot = { archivedAt:new Date().toISOString(), reason:"Clean Passport activation; prior demo workspace preserved.", state:priorState };
await sql`INSERT INTO bleuprint_workspace_state (workspace_id,state_key,state_value,updated_by) VALUES (${workspace},${archiveKey},${JSON.stringify(snapshot)}::jsonb,${actor}) ON CONFLICT (workspace_id,state_key) DO UPDATE SET state_value=EXCLUDED.state_value, updated_at=NOW(), updated_by=EXCLUDED.updated_by`;
await sql`UPDATE bleuprint_documents SET archived_at=COALESCE(archived_at,NOW()), archived_by=COALESCE(archived_by,${actor}), is_record=FALSE WHERE workspace_id=${workspace} AND archived_at IS NULL`;
await sql`UPDATE bleuprint_memory_entries SET archived_at=COALESCE(archived_at,NOW()), archived_by=COALESCE(archived_by,${actor}), updated_at=NOW(), updated_by=${actor} WHERE workspace_id=${workspace} AND archived_at IS NULL`;
await sql`UPDATE bleuprint_mismatches SET status='archived', resolved_at=COALESCE(resolved_at,NOW()), resolved_by=COALESCE(resolved_by,${actor}), resolution_note=COALESCE(resolution_note,'Archived during clean Passport activation; retained for history.') WHERE workspace_id=${workspace} AND status IN ('open','assigned')`;
await sql`INSERT INTO bleuprint_workspace_state (workspace_id,state_key,state_value,updated_by) VALUES (${workspace},'calendar','[]'::jsonb,${actor}) ON CONFLICT (workspace_id,state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW(),updated_by=EXCLUDED.updated_by`;
await sql`INSERT INTO bleuprint_workspace_state (workspace_id,state_key,state_value,updated_by) VALUES (${workspace},'campaigns','[]'::jsonb,${actor}) ON CONFLICT (workspace_id,state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW(),updated_by=EXCLUDED.updated_by`;

for (const source of selectedSources) {
  const raw = await readFile(source.path, "utf8");
  const contentType = source.path.endsWith(".html") ? "text/html" : "text/markdown";
  const text = visibleText(raw);
  const inserted = await sql`INSERT INTO bleuprint_documents (workspace_id,name,pathname,content_type,size_bytes,extracted_text,extraction_state,document_type,destination,context,is_record,uploaded_by) VALUES (${workspace},${source.name},${`db://passport/local-source/${source.name}`},${contentType},${Buffer.byteLength(raw)},${text},'indexed from selected canonical source',${source.type},${source.destination},${JSON.stringify({summary:text.slice(0,700),assumption_policy:'Only explicit source text is routed. Extracted entries remain labelled extracted until a team member confirms them.',source_mode:'local selected source; OneDrive sync has not been configured.'})}::jsonb,${source.record},${actor}) RETURNING id`;
  for (const entry of extractMemoryEntries({name:source.name,contentType,rawText:raw})) await sql`INSERT INTO bleuprint_memory_entries (workspace_id,area,entry_type,status,title,body,source_document_id,source_name,source_location,evidence,created_by,updated_by) VALUES (${workspace},${entry.area},${entry.entryType},${source.record?'confirmed':'extracted'},${entry.title},${entry.body},${inserted[0].id},${source.name},${entry.sourceLocation},${entry.evidence},${actor},${actor})`;
}

const calendar = PASSPORT_WEEK_ONE_CALENDAR.map(row=>({...row,sourceDocument:'PASSPORT_LAUNCH_WEEK_PLAN_v1_2026-09-07.md',sourceMode:'Selected local canonical source',updatedBy:'Kalena',updatedAt:new Date().toISOString()}));
await sql`INSERT INTO bleuprint_workspace_state (workspace_id,state_key,state_value,updated_by) VALUES (${workspace},'calendar',${JSON.stringify(calendar)}::jsonb,${actor}) ON CONFLICT (workspace_id,state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW(),updated_by=EXCLUDED.updated_by`;
await sql`INSERT INTO bleuprint_audit_events (workspace_id,actor_email,event_type,source_name,source_location,detail) VALUES (${workspace},${actor},'workspace.demo_archived_and_real_sources_activated','Passport','Selected desktop Passport sources',${JSON.stringify({archivedSnapshot:archiveKey,activeSources:selectedSources.map(source=>source.name),calendarRows:calendar.length,writeback:'Not configured; active records remain in Bleuprint until Microsoft is authorized.'})}::jsonb)`;
console.log(`Archived prior demo workspace and activated ${selectedSources.length} selected sources with ${calendar.length} content rows.`);
