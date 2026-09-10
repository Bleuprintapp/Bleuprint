import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../../lib/db";
import { getServerMember } from "../../../../lib/server-member";
import { migrateContentRows } from "../../../../lib/migrate-content-rows";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Owner-only door for the content row migration, so it can be run from the
 * browser instead of a Terminal.
 *
 *   /api/admin/migrate-content-rows                      dry run, writes nothing
 *   /api/admin/migrate-content-rows?apply=yes&confirm=N  writes, only when N equals
 *                                                        the calendar row count the
 *                                                        dry run printed
 *
 * Same code as scripts/migrate-content-rows.mjs. Nothing is deleted either way.
 */
export async function GET(request) {
  const member = await getServerMember();
  if (!member) return text("Sign in to the portal first, then open this address again.", 401);
  if (member.role !== "owner") return text("Only the owner can run the migration.", 403);

  const url = new URL(request.url);
  const wantsApply = url.searchParams.get("apply") === "yes";
  const confirm = Number(url.searchParams.get("confirm"));

  await ensureSchema();
  const sql = getSql();

  const dry = await migrateContentRows(sql, { apply: false, actor: member.email });
  if (!wantsApply) {
    return text([
      ...dry.lines,
      "",
      `To write these rows, open: /api/admin/migrate-content-rows?apply=yes&confirm=${dry.calendarRows}`,
    ].join("\n"));
  }
  if (confirm !== dry.calendarRows) {
    return text([
      ...dry.lines,
      "",
      `Not applied. confirm=${Number.isFinite(confirm) ? confirm : "missing"} does not match the ${dry.calendarRows} calendar rows found. Nothing was written.`,
    ].join("\n"), 409);
  }

  const result = await migrateContentRows(sql, { apply: true, actor: member.email });
  return text(result.lines.join("\n"));
}

function text(body, status = 200) {
  return new NextResponse(body + "\n", { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
