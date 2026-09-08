import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";
import { ensureSchema, getSql } from "../../../lib/db";

export const runtime = "nodejs";
const stop = new Set(["what","when","where","which","about","does","from","that","this","with","have","passport","bleuprint"]);
export async function POST(request) {
  const member = await getServerMember(); if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { question = "" } = await request.json().catch(() => ({})); const terms = question.toLowerCase().match(/[a-z0-9]+/g)?.filter(x => x.length > 3 && !stop.has(x)).slice(0,8) || [];
  await ensureSchema(); const docs = await getSql()`SELECT name, extracted_text FROM bleuprint_documents WHERE workspace_id = 'passport' AND extracted_text IS NOT NULL ORDER BY uploaded_at DESC`;
  const matches = docs.map(doc => { const lower = doc.extracted_text.toLowerCase(); const score = terms.reduce((n,t) => n + (lower.includes(t) ? 1 : 0), 0); const first = terms.map(t => lower.indexOf(t)).filter(x => x >= 0).sort((a,b)=>a-b)[0] || 0; return { ...doc, score, excerpt: doc.extracted_text.slice(Math.max(0, first-100), first+280) }; }).filter(x => x.score).sort((a,b)=>b.score-a.score).slice(0,3);
  if (!matches.length) return NextResponse.json({ answer: docs.length ? "I could not find support for that in the uploaded Passport sources." : "Upload Passport source files first. Ask Bleuprint will not invent an answer without evidence.", citations: [] });
  return NextResponse.json({ answer: `I found ${matches.length} relevant source${matches.length === 1 ? "" : "s"}. Review the cited passages before treating this as a decision.`, citations: matches.map(x => ({ name:x.name, excerpt:x.excerpt })) });
}
