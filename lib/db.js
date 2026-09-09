import { neon } from "@neondatabase/serverless";

let initialized = false;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

export async function ensureSchema() {
  if (initialized) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_workspace_state (
      workspace_id TEXT NOT NULL,
      state_key TEXT NOT NULL,
      state_value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL,
      PRIMARY KEY (workspace_id, state_key)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_audit_events (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      event_type TEXT NOT NULL,
      source_name TEXT,
      source_location TEXT,
      detail JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_source_snapshots (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      connector TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_path TEXT,
      fingerprint TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      observed_by TEXT NOT NULL,
      UNIQUE (workspace_id, connector, source_id, fingerprint)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_members (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_sessions (
      token_hash TEXT PRIMARY KEY,
      member_email TEXT NOT NULL REFERENCES bleuprint_members(email) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_documents (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pathname TEXT NOT NULL UNIQUE,
      content_type TEXT,
      size_bytes BIGINT NOT NULL DEFAULT 0,
      extracted_text TEXT,
      extraction_state TEXT NOT NULL DEFAULT 'stored',
      uploaded_by TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE bleuprint_documents ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'unclassified'`;
  await sql`ALTER TABLE bleuprint_documents ADD COLUMN IF NOT EXISTS destination TEXT NOT NULL DEFAULT 'Source inbox'`;
  await sql`ALTER TABLE bleuprint_documents ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE bleuprint_documents ADD COLUMN IF NOT EXISTS is_record BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_mismatches (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      document_id BIGINT REFERENCES bleuprint_documents(id) ON DELETE CASCADE,
      record_document_id BIGINT REFERENCES bleuprint_documents(id) ON DELETE SET NULL,
      mismatch_type TEXT NOT NULL,
      detail TEXT NOT NULL,
      source_location TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE bleuprint_documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;
  await sql`ALTER TABLE bleuprint_documents ADD COLUMN IF NOT EXISTS archived_by TEXT`;
  await sql`ALTER TABLE bleuprint_mismatches ADD COLUMN IF NOT EXISTS resolution_note TEXT`;
  await sql`ALTER TABLE bleuprint_mismatches ADD COLUMN IF NOT EXISTS resolved_by TEXT`;
  await sql`ALTER TABLE bleuprint_mismatches ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`;
  await sql`ALTER TABLE bleuprint_mismatches ADD COLUMN IF NOT EXISTS assigned_to TEXT`;
  await sql`ALTER TABLE bleuprint_mismatches ADD COLUMN IF NOT EXISTS impact JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_memory_entries (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      area TEXT NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'fact',
      status TEXT NOT NULL DEFAULT 'extracted',
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      source_document_id BIGINT REFERENCES bleuprint_documents(id) ON DELETE SET NULL,
      source_name TEXT,
      source_location TEXT,
      evidence TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ,
      archived_by TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_notifications (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      email_state TEXT NOT NULL DEFAULT 'waiting_for_connector',
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_performance_metrics (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      content_id TEXT,
      external_post_id TEXT,
      channel TEXT NOT NULL,
      metric TEXT NOT NULL,
      value NUMERIC NOT NULL,
      source TEXT NOT NULL,
      provisional BOOLEAN NOT NULL DEFAULT TRUE,
      observed_at TIMESTAMPTZ NOT NULL,
      recorded_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, channel, external_post_id, metric, observed_at)
    )
  `;
  initialized = true;
}
