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
  initialized = true;
}
