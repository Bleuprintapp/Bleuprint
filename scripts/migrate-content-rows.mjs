#!/usr/bin/env node
/* Move the calendar and campaigns out of the JSON blobs and into rows.
 *
 *   node scripts/migrate-content-rows.mjs            dry run, prints what would happen
 *   node scripts/migrate-content-rows.mjs --apply    writes rows, keeps the blobs
 *
 * Safe to run more than once: rows that already exist are left alone.
 * Nothing is deleted. The original blobs are copied under archive keys
 * before anything is written, and the live keys are not touched, so the
 * old code keeps working until it is switched over.
 */
if (!process.execArgv.includes("--no-warnings") && !process.env.BLEU_MIGRATE_CHILD) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["--no-warnings", ...process.argv.slice(1)], { stdio: "inherit", env: { ...process.env, BLEU_MIGRATE_CHILD: "1" } });
  process.exit(r.status ?? 1);
}
import { neon } from "@neondatabase/serverless";
import { ensureContentSchema, rowFromBlob } from "../lib/content-schema.js";

const WORKSPACE = "passport";
const ACTOR = "migration@bleuprint";
const APPLY = process.argv.includes("--apply");
const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "_");

// Load .env.local ourselves so the command is just `node scripts/migrate-content-rows.mjs`.
import { readFileSync } from "node:fs";
if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* no .env.local; fall through to the check below */ }
}
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set and .env.local was not found next to the repo."); process.exit(1); }
const sql = neon(url);

let state;
try {
  state = await sql`SELECT state_key, state_value FROM bleuprint_workspace_state WHERE workspace_id=${WORKSPACE} AND state_key IN ('calendar','campaigns')`;
} catch (error) {
  console.error("Could not reach the database from this computer.");
  console.error("Reason:", error?.cause?.message || error?.message || error);
  console.error("Run this from Terminal on the Mac (not inside another sandbox), on a normal internet connection, and try again.");
  process.exit(1);
}
const blob = Object.fromEntries(state.map(r => [r.state_key, r.state_value]));
const calendar = Array.isArray(blob.calendar) ? blob.calendar : [];
const campaigns = Array.isArray(blob.campaigns) ? blob.campaigns : [];

const byChannel = calendar.reduce((acc, r) => ((acc[r.channel || "Unassigned"] = (acc[r.channel || "Unassigned"] || 0) + 1), acc), {});
console.log(`${APPLY ? "APPLY" : "DRY RUN"} · ${calendar.length} calendar rows · ${campaigns.length} campaigns`);
console.log("  by channel:", JSON.stringify(byChannel));

const outputs = campaigns.flatMap(c => Object.entries(c.outputs || {}).map(([channel, o]) => ({ campaign: c, channel, output: o })));
const orphanOutputs = outputs.filter(o => !calendar.some(r => r.id === (o.output.calendarId || o.campaign.calendarId)));
console.log(`  ${outputs.length} campaign outputs, ${orphanOutputs.length} pointing at a row that does not exist (these will be skipped and listed)`);
orphanOutputs.forEach(o => console.log(`    skip: campaign ${o.campaign.id} / ${o.channel} → row ${o.output.calendarId || o.campaign.calendarId}`));

if (!APPLY) { console.log("\nDry run only. Re-run with --apply to write."); process.exit(0); }

await ensureContentSchema(sql);

// 1. Keep the originals, untouched, under archive keys.
for (const key of ["calendar", "campaigns"]) {
  if (blob[key] === undefined) continue;
  await sql`
    INSERT INTO bleuprint_workspace_state (workspace_id, state_key, state_value, updated_by)
    VALUES (${WORKSPACE}, ${`archive_${key}_blob_${stamp}`}, ${JSON.stringify(blob[key])}::jsonb, ${ACTOR})
    ON CONFLICT (workspace_id, state_key) DO NOTHING
  `;
}

// 2. Campaigns first, because rows point at them.
let campaignsWritten = 0;
for (const c of campaigns) {
  const res = await sql`
    INSERT INTO bleuprint_campaigns (id, workspace_id, campaign_key, title, week, status, approved_by, approved_at, created_by, updated_by, updated_at)
    VALUES (${String(c.id)}, ${WORKSPACE}, ${c.campaignKey || c.id}, ${c.title || "Untitled"}, ${c.week || null}, ${c.status || "Draft"},
            ${c.status === "Approved" ? (c.updatedBy || null) : null}, ${c.status === "Approved" ? (c.updatedAt || null) : null},
            ${c.createdBy || ACTOR}, ${c.updatedBy || ACTOR}, ${c.updatedAt || new Date().toISOString()})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  campaignsWritten += res.length;
}

// 3. Rows. Link to a campaign only when that campaign exists.
const campaignIds = new Set(campaigns.map(c => String(c.id)));
let rowsWritten = 0;
for (const r of calendar) {
  const m = rowFromBlob(r, ACTOR);
  const campaignId = r.campaignId && campaignIds.has(String(r.campaignId)) ? String(r.campaignId) : null;
  const res = await sql`
    INSERT INTO bleuprint_content_rows (
      id, workspace_id, campaign_id, campaign_key, channel, date_text, scheduled_on, time_text, week, title, pillar, proof,
      format, production_format, brief, caption_a, caption_b, screen, script, source_asset, shared_asset_with,
      source_document, source_location, status, previous_status, owner, buffer_post_id, buffer_status, buffer_due_at,
      created_by, updated_by, updated_at, archived_at, archived_by)
    VALUES (
      ${m.id}, ${WORKSPACE}, ${campaignId}, ${m.campaign_key}, ${m.channel}, ${m.date_text}, ${m.scheduled_on}, ${m.time_text}, ${m.week}, ${m.title}, ${m.pillar}, ${m.proof},
      ${m.format}, ${m.production_format}, ${m.brief}, ${m.caption_a}, ${m.caption_b}, ${m.screen}, ${m.script}, ${m.source_asset}, ${m.shared_asset_with},
      ${m.source_document}, ${m.source_location}, ${m.status}, ${m.previous_status}, ${m.owner}, ${m.buffer_post_id}, ${m.buffer_status}, ${m.buffer_due_at},
      ${m.created_by}, ${m.updated_by}, ${m.updated_at || new Date().toISOString()}, ${m.archived_at}, ${m.archived_by})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  if (res.length) {
    rowsWritten += 1;
    await sql`
      INSERT INTO bleuprint_record_revisions (workspace_id, record_type, record_id, field, previous_value, next_value, actor_email, reason, source_name, source_location)
      VALUES (${WORKSPACE}, 'content_row', ${m.id}, 'migrated', NULL, ${m.status}, ${ACTOR}, 'Moved from the calendar JSON blob into its own row', ${m.source_document}, ${m.source_location})
    `;
  }
}

// 4. Outputs, one per campaign per channel, each tied to its row.
let outputsWritten = 0;
for (const { campaign, channel, output } of outputs) {
  const rowId = String(output.calendarId || campaign.calendarId || "");
  if (!calendar.some(r => String(r.id) === rowId)) continue;
  const res = await sql`
    INSERT INTO bleuprint_campaign_outputs (workspace_id, campaign_id, content_row_id, channel, format, proof, brief, script, caption, alternate, assets, slides, updated_by, updated_at)
    VALUES (${WORKSPACE}, ${String(campaign.id)}, ${rowId}, ${channel}, ${output.format || null}, ${output.proof || null}, ${output.brief || null}, ${output.script || null},
            ${output.caption || null}, ${output.alternate || null}, ${JSON.stringify(output.assets || [])}::jsonb, ${JSON.stringify(output.slides || [])}::jsonb,
            ${campaign.updatedBy || ACTOR}, ${campaign.updatedAt || new Date().toISOString()})
    ON CONFLICT (campaign_id, content_row_id) DO NOTHING
    RETURNING id
  `;
  outputsWritten += res.length;
}

await sql`
  INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, detail)
  VALUES (${WORKSPACE}, ${ACTOR}, 'content.migrated_to_rows', 'migration',
          ${JSON.stringify({ calendarRows: calendar.length, rowsWritten, campaigns: campaigns.length, campaignsWritten, outputsWritten, archiveKeys: [`archive_calendar_blob_${stamp}`, `archive_campaigns_blob_${stamp}`] })}::jsonb)
`;

// 5. Prove it.
const check = await sql`SELECT channel, COUNT(*)::int AS n FROM bleuprint_content_rows WHERE workspace_id=${WORKSPACE} AND archived_at IS NULL GROUP BY channel ORDER BY channel`;
const blobStill = await sql`SELECT COUNT(*)::int AS n FROM bleuprint_workspace_state WHERE workspace_id=${WORKSPACE} AND state_key IN ('calendar','campaigns')`;
console.log(`\nWrote ${rowsWritten} rows, ${campaignsWritten} campaigns, ${outputsWritten} outputs.`);
console.log("  rows now by channel:", JSON.stringify(Object.fromEntries(check.map(r => [r.channel, r.n]))));
console.log(`  original blobs still present: ${blobStill[0].n === 2 ? "yes" : "NO, something is wrong"}`);
