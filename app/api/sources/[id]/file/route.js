import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getServerMember } from "../../../../../lib/server-member";
import { ensureSchema, getSql } from "../../../../../lib/db";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const { id } = await params;
  await ensureSchema();
  const rows = await getSql()`SELECT pathname, content_type, extracted_text, name FROM bleuprint_documents WHERE id = ${id} AND workspace_id = 'passport' LIMIT 1`;
  const record = rows[0];
  if (!record) return NextResponse.json({ error:"File not found" }, { status:404 });
  if (record.pathname.startsWith("db://")) return new Response(record.extracted_text || "", { headers:{"content-type":record.content_type || "text/plain","content-disposition":`inline; filename="${record.name.replaceAll('"','')}"`} });
  try {
    const result = await get(record.pathname, { access:"private" });
    if (!result?.stream) return NextResponse.json({ error:"Stored file unavailable" }, { status:404 });
    return new Response(result.stream, { headers:{"content-type":result.blob.contentType || record.content_type || "application/octet-stream","content-length":String(result.blob.size || ""),"cache-control":"private, max-age=300"} });
  } catch (error) {
    return NextResponse.json({ error:"Stored file is connected but cannot be opened from this environment.", detail:error.message }, { status:503 });
  }
}
