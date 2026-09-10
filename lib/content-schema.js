/* Content rows, campaigns and revisions as real records.
 *
 * Until now the calendar and the campaigns lived as two JSON arrays in
 * bleuprint_workspace_state. Every edit rewrote the whole array, so two
 * people editing at once silently overwrote each other, nothing had a
 * history, and a campaign was tied to its posts by a matching string.
 *
 * Shape, learned from the code rather than assumed:
 *   one campaign  →  many content rows (a post per channel)
 *   one output    →  exactly one content row, inside one campaign
 *   a row may exist before its campaign is built
 *   approving a campaign stamps every row beneath it
 *
 * Nothing here deletes anything. The migration keeps the original blobs
 * under archive keys in bleuprint_workspace_state.
 */

export async function ensureContentSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_campaigns (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      campaign_key TEXT NOT NULL,
      title TEXT NOT NULL,
      week TEXT,
      status TEXT NOT NULL DEFAULT 'Draft',
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ,
      archived_by TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bleuprint_campaigns_ws_key ON bleuprint_campaigns (workspace_id, campaign_key)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_content_rows (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      campaign_id TEXT REFERENCES bleuprint_campaigns(id) ON DELETE SET NULL,
      campaign_key TEXT,
      channel TEXT NOT NULL,
      date_text TEXT,
      scheduled_on DATE,
      time_text TEXT,
      week TEXT,
      title TEXT NOT NULL,
      pillar TEXT,
      proof TEXT,
      format TEXT,
      production_format TEXT,
      brief TEXT,
      caption_a TEXT,
      caption_b TEXT,
      screen TEXT,
      script TEXT,
      source_asset TEXT,
      shared_asset_with TEXT,
      source_document TEXT,
      source_location TEXT,
      status TEXT NOT NULL DEFAULT 'Draft',
      previous_status TEXT,
      owner TEXT,
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      buffer_post_id TEXT,
      buffer_status TEXT,
      buffer_due_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ,
      archived_by TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bleuprint_content_rows_ws_date ON bleuprint_content_rows (workspace_id, scheduled_on)`;
  await sql`CREATE INDEX IF NOT EXISTS bleuprint_content_rows_campaign ON bleuprint_content_rows (campaign_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_campaign_outputs (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL REFERENCES bleuprint_campaigns(id) ON DELETE CASCADE,
      content_row_id TEXT NOT NULL REFERENCES bleuprint_content_rows(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      format TEXT,
      proof TEXT,
      brief TEXT,
      script TEXT,
      caption TEXT,
      alternate TEXT,
      assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      slides JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_by TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (campaign_id, content_row_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_record_revisions (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      field TEXT NOT NULL,
      previous_value TEXT,
      next_value TEXT,
      actor_email TEXT NOT NULL,
      reason TEXT,
      source_name TEXT,
      source_location TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bleuprint_revisions_record ON bleuprint_record_revisions (workspace_id, record_type, record_id, created_at DESC)`;
}

// Fields on a content row that a person can change, and that therefore get
// a revision when they do. Everything else is set by the system.
export const CONTENT_ROW_EDITABLE = [
  "channel", "date_text", "time_text", "week", "title", "pillar", "proof", "format", "production_format",
  "brief", "caption_a", "caption_b", "screen", "script", "source_asset", "shared_asset_with",
  "source_document", "source_location", "status", "owner",
];

export const isoDate = value => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);

// Map a row from the old JSON shape to the new columns. Lossless: every
// field the old code ever wrote has a column.
export function rowFromBlob(row, actor) {
  const date = row.date || row.day || null;
  return {
    id: String(row.id),
    campaign_key: row.campaignKey || row.campaignId || null,
    channel: row.channel || "Unassigned",
    date_text: date,
    scheduled_on: isoDate(date),
    time_text: row.time || null,
    week: row.week || null,
    title: row.title || "Untitled",
    pillar: row.pillar || null,
    proof: row.proof || row.proofLabel || null,
    format: row.format || null,
    production_format: row.productionFormat || null,
    brief: row.brief || null,
    caption_a: row.captionA ?? row.copy?.a ?? (typeof row.copy === "string" ? row.copy : null),
    caption_b: row.captionB ?? row.copy?.b ?? null,
    screen: row.screen || null,
    script: row.script || null,
    source_asset: row.sourceAsset || null,
    shared_asset_with: row.sharedAssetWith || null,
    source_document: row.sourceDocument || null,
    source_location: row.sourceLocation || null,
    status: row.status || "Draft",
    previous_status: row.previousStatus || null,
    owner: row.owner || null,
    buffer_post_id: row.bufferPostId || null,
    buffer_status: row.bufferStatus || null,
    buffer_due_at: row.bufferDueAt || null,
    created_by: row.createdBy || actor,
    updated_by: row.updatedBy || actor,
    updated_at: row.updatedAt || null,
    archived_at: row.archivedAt || null,
    archived_by: row.archivedBy || null,
  };
}
