import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const WORKSPACE = "passport";
export const CONNECTOR = "microsoft";

// Delegated scopes. These must stay in step with the app registration in Entra.
// offline_access is what makes a refresh token available; without it the
// connection dies roughly an hour after it is made.
export const SCOPES = ["openid", "profile", "offline_access", "User.Read", "Files.ReadWrite"];

const AUTH_HOST = "https://login.microsoftonline.com";
const GRAPH = "https://graph.microsoft.com/v1.0";

export function microsoftConfig() {
  const clientId = process.env.MS_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MS_TENANT_ID || process.env.MICROSOFT_TENANT_ID;
  const redirectUri = process.env.MS_REDIRECT_URI || process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !clientSecret || !tenantId || !redirectUri) return null;
  return { clientId, clientSecret, tenantId, redirectUri };
}

export function configState() {
  const missing = ["MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_TENANT_ID", "MS_REDIRECT_URI"]
    .filter(name => !process.env[name] && !process.env[name.replace("MS_", "MICROSOFT_")]);
  return { ready: missing.length === 0, missing };
}

/* ---------------------------------------------------------------
   Token storage

   Tokens are encrypted at rest with a key derived from the client
   secret, so rotating the secret in Entra invalidates every stored
   token and forces a fresh authorization. That is the behaviour we
   want: a rotated secret should not leave live tokens behind.
   --------------------------------------------------------------- */

function encryptionKey() {
  const config = microsoftConfig();
  if (!config) throw new Error("Microsoft is not configured");
  return scryptSync(config.clientSecret, "bleuprint.passport.connector.v1", 32);
}

export function encryptSecret(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload) {
  const [version, iv, tag, body] = String(payload || "").split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Stored token is not readable");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

export async function ensureConnectorSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_connector_tokens (
      workspace_id TEXT NOT NULL,
      connector TEXT NOT NULL,
      member_email TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      scope TEXT,
      account_label TEXT,
      account_id TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_error TEXT,
      PRIMARY KEY (workspace_id, connector, member_email)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bleuprint_connector_folders (
      id BIGSERIAL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      connector TEXT NOT NULL,
      drive_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      folder_name TEXT NOT NULL,
      folder_path TEXT,
      delta_link TEXT,
      selected_by TEXT NOT NULL,
      selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_synced_at TIMESTAMPTZ,
      UNIQUE (workspace_id, connector, drive_id, item_id)
    )
  `;
}

/* ---------------------------------------------------------------
   OAuth
   --------------------------------------------------------------- */

export function authorizeUrl({ state }) {
  const config = microsoftConfig();
  if (!config) throw new Error("Microsoft is not configured");
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTH_HOST}/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function tokenRequest(body) {
  const config = microsoftConfig();
  if (!config) throw new Error("Microsoft is not configured");
  const response = await fetch(`${AUTH_HOST}/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...body }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error_description || data.error || `Microsoft returned ${response.status}`;
    throw new Error(String(detail).split("\n")[0]);
  }
  return data;
}

export function exchangeCode(code) {
  const config = microsoftConfig();
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri, scope: SCOPES.join(" ") });
}

export function refreshTokens(refreshToken) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken, scope: SCOPES.join(" ") });
}

export function safeCompare(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length || !left.length) return false;
  return timingSafeEqual(left, right);
}

/* ---------------------------------------------------------------
   Stored connection
   --------------------------------------------------------------- */

export async function saveTokens(sql, { memberEmail, tokens, accountLabel, accountId }) {
  await ensureConnectorSchema(sql);
  const expiresAt = new Date(Date.now() + Math.max(60, Number(tokens.expires_in) || 3600) * 1000).toISOString();
  const access = encryptSecret(tokens.access_token);
  const refresh = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null;
  await sql`
    INSERT INTO bleuprint_connector_tokens
      (workspace_id, connector, member_email, access_token, refresh_token, scope, account_label, account_id, expires_at, last_error)
    VALUES
      (${WORKSPACE}, ${CONNECTOR}, ${memberEmail}, ${access}, ${refresh}, ${tokens.scope || SCOPES.join(" ")}, ${accountLabel || null}, ${accountId || null}, ${expiresAt}, NULL)
    ON CONFLICT (workspace_id, connector, member_email) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, bleuprint_connector_tokens.refresh_token),
      scope = EXCLUDED.scope,
      account_label = COALESCE(EXCLUDED.account_label, bleuprint_connector_tokens.account_label),
      account_id = COALESCE(EXCLUDED.account_id, bleuprint_connector_tokens.account_id),
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW(),
      last_error = NULL
  `;
}

export async function connectionRow(sql, memberEmail) {
  await ensureConnectorSchema(sql);
  const rows = await sql`
    SELECT member_email, account_label, account_id, scope, expires_at, connected_at, updated_at, last_error,
           (refresh_token IS NOT NULL) AS has_refresh
    FROM bleuprint_connector_tokens
    WHERE workspace_id = ${WORKSPACE} AND connector = ${CONNECTOR} AND member_email = ${memberEmail}
    LIMIT 1
  `;
  return rows[0] || null;
}

// Returns a usable access token, refreshing when it is close to expiry.
// Returns null when the workspace has never authorized, or when the refresh
// token has been revoked. Never throws for the ordinary "not connected" case.
export async function accessTokenFor(sql, memberEmail) {
  await ensureConnectorSchema(sql);
  const rows = await sql`
    SELECT access_token, refresh_token, expires_at
    FROM bleuprint_connector_tokens
    WHERE workspace_id = ${WORKSPACE} AND connector = ${CONNECTOR} AND member_email = ${memberEmail}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() > 120000) {
    try { return decryptSecret(row.access_token); } catch { return null; }
  }
  if (!row.refresh_token) return null;

  try {
    const tokens = await refreshTokens(decryptSecret(row.refresh_token));
    await saveTokens(sql, { memberEmail, tokens });
    return tokens.access_token;
  } catch (error) {
    await sql`
      UPDATE bleuprint_connector_tokens SET last_error = ${String(error.message).slice(0, 400)}, updated_at = NOW()
      WHERE workspace_id = ${WORKSPACE} AND connector = ${CONNECTOR} AND member_email = ${memberEmail}
    `;
    return null;
  }
}

export async function graphFetch(accessToken, path, init = {}) {
  const response = await fetch(path.startsWith("http") ? path : `${GRAPH}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Microsoft Graph returned ${response.status}`);
  return data;
}
