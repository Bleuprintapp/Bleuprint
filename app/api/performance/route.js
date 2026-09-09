import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../lib/db";
import { getServerMember } from "../../../lib/server-member";

const WORKSPACE="passport";
const bufferReady=()=>Boolean(process.env.BUFFER_API_KEY);
export async function GET(){
  const member=await getServerMember(); if(!member)return NextResponse.json({error:"Unauthorized"},{status:401});
  await ensureSchema(); const sql=getSql();
  const [metrics,stateRows]=await Promise.all([
    sql`SELECT id,content_id,external_post_id,channel,metric,value,source,provisional,observed_at FROM bleuprint_performance_metrics WHERE workspace_id=${WORKSPACE} ORDER BY observed_at DESC LIMIT 500`,
    sql`SELECT state_value FROM bleuprint_workspace_state WHERE workspace_id=${WORKSPACE} AND state_key='calendar' LIMIT 1`,
  ]);
  const calendar=Array.isArray(stateRows[0]?.state_value)?stateRows[0].state_value:[];
  const now=Date.now(); const soon=now+3*24*60*60*1000;
  const active=calendar.filter(row=>!["Archived","Done","Published"].includes(row.status));
  const missing=["Instagram","TikTok","LinkedIn"].filter(channel=>!active.some(row=>{
    const due=Date.parse(row.date||row.day||"");
    return row.channel===channel&&Number.isFinite(due)&&due>=now&&due<=soon;
  })).map(channel=>({channel,date:"the next 3 days"}));
  return NextResponse.json({metrics,buffer:{state:bufferReady()?"ready":"needs-api-key",metrics:"personal-key workflow · up to 24 hours behind the network"},upcoming:active.slice(0,12),missing});
}
export async function POST(request){
  const member=await getServerMember(); if(!member)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>({}));
  if(!body.channel||!body.metric||!Number.isFinite(Number(body.value)))return NextResponse.json({error:"Channel, metric, and numeric value are required"},{status:400});
  await ensureSchema(); const sql=getSql(); const observed=body.observedAt||new Date().toISOString();
  await sql`INSERT INTO bleuprint_performance_metrics (workspace_id,content_id,external_post_id,channel,metric,value,source,provisional,observed_at,recorded_by) VALUES (${WORKSPACE},${body.contentId||null},${body.externalPostId||null},${body.channel},${body.metric},${Number(body.value)},${body.source||"manual import"},${body.provisional!==false},${observed},${member.email}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ok:true});
}
