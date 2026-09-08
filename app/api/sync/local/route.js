import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../../lib/db";
import { getServerMember } from "../../../../lib/server-member";

export async function POST(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const files = Array.isArray(body?.files) ? body.files.slice(0, 2000) : [];
  await ensureSchema();
  const sql = getSql();
  let recorded = 0;
  for (const file of files) {
    if (!file?.name) continue;
    const sourceId = String(file.path || file.name);
    const fingerprint = String(file.fingerprint || createHash("sha256").update(JSON.stringify(file)).digest("hex"));
    await sql`
      INSERT INTO bleuprint_source_snapshots
        (workspace_id, connector, source_id, source_name, source_path, fingerprint, metadata, observed_by)
      VALUES
        ('passport', 'local', ${sourceId}, ${String(file.name)}, ${String(file.path || "")}, ${fingerprint}, ${JSON.stringify(file)}::jsonb, ${member.email})
      ON CONFLICT DO NOTHING
    `;
    recorded += 1;
  }
  await sql`
    INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, detail)
    VALUES ('passport', ${member.email}, 'connector.local.sync', ${String(body?.folder || "Local folder")}, ${JSON.stringify({ files: recorded })}::jsonb)
  `;
  return NextResponse.json({ ok: true, recorded });
}
