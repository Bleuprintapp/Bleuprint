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
  initialized = true;
}
