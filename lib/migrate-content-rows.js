/* Move the calendar and campaigns out of the JSON blobs and into rows.
 *
 * Shared by the Terminal script (scripts/migrate-content-rows.mjs) and the
 * owner-only route (/api/admin/migrate-content-rows) so the same code runs
 * whichever door it is opened through.
 *
 * Safe to run more than once: rows that already exist are left alone.
 * Nothing is deleted. The original blobs are copied under archive keys
 * before anything is written, and the live keys are not touched, so the
 * old code keeps working until it is switched over.
 */
import { ensureContentSchema, rowFromBlob } from "./content-schema.js";

export async function migrateContentRows(sql, { apply = false, workspace = "passport", actor = "migration@bleuprint" } = {}) {
  const lines = [];
  const log = (s = "") => lines.push(s);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "_");

  const state = await sql`SELECT state_key, state_value FROM bleuprint_workspace_state WHERE workspace_id=${workspace} AND state_key IN ('calendar','campaigns')`;
  const blob = Object.fromEntries(state.map(r => [r.state_key, r.state_value]));
  const calendar = Array.isArray(blob.calendar) ? blob.calendar : [];
  const campaigns = Array.isArray(blob.campaigns) ? blob.campaigns : [];

  const byChannel = calendar.reduce((acc, r) => ((acc[r.channel || "Unassigned"] = (acc[r.channel || "Unassigned"] || 0) + 1), acc), {});
  log(`${apply ? "APPLY" : "DRY RUN"} · ${calendar.length} calendar rows · ${campaigns.length} campaigns`);
  log(`  by channel: ${JSON.stringify(byChannel)}`);

  const outputs = campaigns.flatMap(c => Object.entries(c.outputs || {}).map(([channel, o]) => ({ campaign: c, channel, output: o })));
  const orphanOutputs = outputs.filter(o => !calendar.some(r => r.id === (o.output.calendarId || o.campaign.calendarId)));
  log(`  ${outputs.length} campaign outputs, ${orphanOutputs.length} pointing at a row that does not exist (these will be skipped and listed)`);
  orphanOutputs.forEach(o => log(`    skip: campaign ${o.campaign.id} / ${o.channel} → row ${o.output.calendarId || o.campaign.calendarId}`));

  const summary = { apply, calendarRows: calendar.length, campaigns: campaigns.length, outputs: outputs.length, orphanOutputs: orphanOutputs.length, byChannel };

  if (!apply) {
    log("");
    log("Dry run only. Nothing was written.");
    return { ...summary, lines };
  }

  await ensureContentSchema(sql);

  // 1. Keep the originals, untouched, under archive keys.
  for (const key of ["calendar", "campaigns"]) {
    if (blob[key] === undefined) continue;
    await sql`
      INSERT INTO bleuprint_workspace_state (workspace_id, state_key, state_value, updated_by)
      VALUES (${workspace}, ${`archive_${key}_blob_${stamp}`}, ${JSON.stringify(blob[key])}::jsonb, ${actor})
      ON CONFLICT (workspace_id, state_key) DO NOTHING
    `;
  }

  // 2. Campaigns first, because rows point at them.
  let campaignsWritten = 0;
  for (const c of campaigns) {
    const res = await sql`
      INSERT INTO bleuprint_campaigns (id, workspace_id, campaign_key, title, week, status, approved_by, approved_at, created_by, updated_by, updated_at)
      VALUES (${String(c.id)}, ${workspace}, ${c.campaignKey || c.id}, ${c.title || "Untitled"}, ${c.week || null}, ${c.status || "Draft"},
              ${c.status === "Approved" ? (c.updatedBy || null) : null}, ${c.status === "Approved" ? (c.updatedAt || null) : null},
              ${c.createdBy || actor}, ${c.updatedBy || actor}, ${c.updatedAt || new Date().toISOString()})
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    campaignsWritten += res.length;
  }

  // 3. Rows. Link to a campaign only when that campaign exists.
  const campaignIds = new Set(campaigns.map(c => String(c.id)));
  let rowsWritten = 0;
  for (const r of calendar) {
    const m = rowFromBlob(r, actor);
    const campaignId = r.campaignId && campaignIds.has(String(r.campaignId)) ? String(r.campaignId) : null;
    const res = await sql`
      INSERT INTO bleuprint_content_rows (
        id, workspace_id, campaign_id, campaign_key, channel, date_text, scheduled_on, time_text, week, title, pillar, proof,
        format, production_format, brief, caption_a, caption_b, screen, script, source_asset, shared_asset_with,
        source_document, source_location, status, previous_status, owner, buffer_post_id, buffer_status, buffer_due_at,
        created_by, updated_by, updated_at, archived_at, archived_by)
      VALUES (
        ${m.id}, ${workspace}, ${campaignId}, ${m.campaign_key}, ${m.channel}, ${m.date_text}, ${m.scheduled_on}, ${m.time_text}, ${m.week}, ${m.title}, ${m.pillar}, ${m.proof},
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
        VALUES (${workspace}, 'content_row', ${m.id}, 'migrated', NULL, ${m.status}, ${actor}, 'Moved from the calendar JSON blob into its own row', ${m.source_document}, ${m.source_location})
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
      VALUES (${workspace}, ${String(campaign.id)}, ${rowId}, ${channel}, ${output.format || null}, ${output.proof || null}, ${output.brief || null}, ${output.script || null},
              ${output.caption || null}, ${output.alternate || null}, ${JSON.stringify(output.assets || [])}::jsonb, ${JSON.stringify(output.slides || [])}::jsonb,
              ${campaign.updatedBy || actor}, ${campaign.updatedAt || new Date().toISOString()})
      ON CONFLICT (campaign_id, content_row_id) DO NOTHING
      RETURNING id
    `;
    outputsWritten += res.length;
  }

  const archiveKeys = [`archive_calendar_blob_${stamp}`, `archive_campaigns_blob_${stamp}`];
  await sql`
    INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, detail)
    VALUES (${workspace}, ${actor}, 'content.migrated_to_rows', 'migration',
            ${JSON.stringify({ calendarRows: calendar.length, rowsWritten, campaigns: campaigns.length, campaignsWritten, outputsWritten, archiveKeys })}::jsonb)
  `;

  // 5. Prove it.
  const check = await sql`SELECT channel, COUNT(*)::int AS n FROM bleuprint_content_rows WHERE workspace_id=${workspace} AND archived_at IS NULL GROUP BY channel ORDER BY channel`;
  const blobStill = await sql`SELECT COUNT(*)::int AS n FROM bleuprint_workspace_state WHERE workspace_id=${workspace} AND state_key IN ('calendar','campaigns')`;
  const rowsNow = Object.fromEntries(check.map(r => [r.channel, r.n]));
  log("");
  log(`Wrote ${rowsWritten} rows, ${campaignsWritten} campaigns, ${outputsWritten} outputs.`);
  log(`  rows now by channel: ${JSON.stringify(rowsNow)}`);
  log(`  original blobs still present: ${blobStill[0].n === 2 ? "yes" : "NO, something is wrong"}`);
  return { ...summary, rowsWritten, campaignsWritten, outputsWritten, rowsNow, blobsStillPresent: blobStill[0].n === 2, archiveKeys, lines };
}
