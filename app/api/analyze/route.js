import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";
import { ensureSchema, getSql } from "../../../lib/db";

export async function POST(request) {
  const member = await getServerMember(); if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { calendar = [], campaigns = [] } = await request.json().catch(() => ({})); const findings = [];
  const dates = [...new Set(calendar.map(x => x.date || x.day).filter(Boolean))];
  for (const date of dates) { const day = calendar.filter(x => (x.date || x.day) === date); if (day.some(x => x.channel === "Instagram") && !day.some(x => x.channel === "LinkedIn") && !calendar.some(x => x.channel === "LinkedIn" && x.campaignId && day.some(y => y.campaignId === x.campaignId))) findings.push(`${date}: Instagram has no LinkedIn framing tied to the same campaign.`); }
  for (const campaign of campaigns) { const rows = calendar.filter(x => x.campaignId === campaign.id); if (!rows.length) findings.push(`${campaign.theme}: campaign has no calendar placement.`); if (campaign.outputs?.tiktok && !rows.some(x=>x.channel === "TikTok")) findings.push(`${campaign.theme}: TikTok output exists but is missing from the calendar.`); }
  await ensureSchema(); const docs = await getSql()`SELECT name FROM bleuprint_documents WHERE workspace_id = 'passport' ORDER BY uploaded_at DESC`;
  if (!docs.length) findings.push("No uploaded Passport source is available, so brand alignment cannot be verified yet.");
  if (!calendar.length) findings.push("The content calendar is empty.");
  if (!findings.length) findings.push("No missing platform handoffs or orphaned campaign outputs were found in the current plan.");
  return NextResponse.json({ title: `${findings.length} intelligence finding${findings.length === 1 ? "" : "s"}`, findings, sources: docs.map(x=>x.name).slice(0,5) });
}
