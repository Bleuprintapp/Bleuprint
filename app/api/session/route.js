import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../lib/db";
import { memberForEmail } from "../../../lib/members";

const scrypt = promisify(scryptCallback);
export const runtime = "nodejs";

export async function POST(request) {
  const { email = "", password = "" } = await request.json().catch(() => ({}));
  const member = memberForEmail(email);
  if (!member || typeof password !== "string" || password.length > 256) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT password_salt, password_hash FROM bleuprint_members WHERE email = ${member.email} LIMIT 1`;
  const record = rows[0];
  if (!record) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const candidate = await scrypt(password, Buffer.from(record.password_salt, "hex"), 64);
  const expected = Buffer.from(record.password_hash, "hex");
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`DELETE FROM bleuprint_sessions WHERE expires_at <= NOW()`;
  await sql`INSERT INTO bleuprint_sessions (token_hash, member_email, expires_at) VALUES (${tokenHash}, ${member.email}, NOW() + INTERVAL '7 days')`;
  const response = NextResponse.json({ member });
  response.cookies.set("bleuprint_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("bleuprint_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
