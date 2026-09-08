import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getServerMember } from "../../../../lib/server-member";
import { ensureSchema, getSql } from "../../../../lib/db";

const scrypt = promisify(scryptCallback);
export const runtime = "nodejs";

export async function POST(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const { currentPassword = "", newPassword = "" } = await request.json().catch(() => ({}));
  if (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 256) return NextResponse.json({ error: "Password must be at least 12 characters" }, { status: 400 });
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT password_salt, password_hash FROM bleuprint_members WHERE email = ${member.email} LIMIT 1`;
  const current = await scrypt(currentPassword, Buffer.from(rows[0].password_salt, "hex"), 64);
  const expected = Buffer.from(rows[0].password_hash, "hex");
  if (current.length !== expected.length || !timingSafeEqual(current, expected)) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  const salt = randomBytes(16);
  const hash = await scrypt(newPassword, salt, 64);
  await sql`UPDATE bleuprint_members SET password_salt = ${salt.toString("hex")}, password_hash = ${hash.toString("hex")}, password_updated_at = NOW() WHERE email = ${member.email}`;
  await sql`INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, detail) VALUES ('passport', ${member.email}, 'member.password.changed', '{}'::jsonb)`;
  return NextResponse.json({ ok: true });
}
