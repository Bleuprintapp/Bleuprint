import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { ensureSchema, getSql } from "./db";
import { memberForEmail } from "./members";

export async function getServerMember() {
  if (process.env.NODE_ENV === "development" && process.env.BLEUPRINT_REQUIRE_LOCAL_LOGIN !== "true") return memberForEmail("kgardner@discoverultrium.com");
  const token = (await cookies()).get("bleuprint_session")?.value;
  if (!token) return null;
  await ensureSchema();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sql = getSql();
  const rows = await sql`SELECT member_email FROM bleuprint_sessions WHERE token_hash = ${tokenHash} AND expires_at > NOW() LIMIT 1`;
  return memberForEmail(rows[0]?.member_email);
}
