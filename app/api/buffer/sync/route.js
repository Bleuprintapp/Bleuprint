import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../../lib/db";
import { getServerMember } from "../../../../lib/server-member";

const WORKSPACE="passport";
const QUERY=`query PassportPosts($organizationId: String!) {
  posts(first: 100, input: { organizationId: $organizationId, sort: [{ field: dueAt, direction: desc }] }) {
    edges { node { id text dueAt status channelId metrics { type name value unit } metricsUpdatedAt } }
  }
  channels(input: { organizationId: $organizationId }) { id name service }
}`;

export async function POST(){
  const member=await getServerMember(); if(!member)return NextResponse.json({error:"Unauthorized"},{status:401});
  const token=process.env.BUFFER_API_KEY;
  if(!token)return NextResponse.json({error:"Buffer is not connected yet. Add BUFFER_API_KEY in Vercel."},{status:409});
  const accountResponse=await fetch("https://api.buffer.com",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({query:"query { account { organizations { id name } } }"}),cache:"no-store"});
  const account=await accountResponse.json();
  const organizationId=process.env.BUFFER_ORGANIZATION_ID||account.data?.account?.organizations?.[0]?.id;
  if(!organizationId)return NextResponse.json({error:account.errors?.[0]?.message||"Buffer did not return an organization for this key."},{status:502});
  const response=await fetch("https://api.buffer.com",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({query:QUERY,variables:{organizationId}}),cache:"no-store"});
  const result=await response.json(); if(!response.ok||result.errors?.length)return NextResponse.json({error:result.errors?.[0]?.message||"Buffer sync failed"},{status:502});
  await ensureSchema(); const sql=getSql();
  const channels=new Map((result.data?.channels||[]).map(item=>[item.id,item]));
  const posts=(result.data?.posts?.edges||[]).map(edge=>edge.node);
  for(const post of posts){
    const channel=channels.get(post.channelId)?.service||channels.get(post.channelId)?.name||"unknown";
    for(const metric of post.metrics||[]){
      if(!Number.isFinite(Number(metric.value)))continue;
      await sql`INSERT INTO bleuprint_performance_metrics (workspace_id,external_post_id,channel,metric,value,source,provisional,observed_at,recorded_by) VALUES (${WORKSPACE},${post.id},${channel},${metric.type||metric.name},${Number(metric.value)},'Buffer',TRUE,${post.metricsUpdatedAt||new Date().toISOString()},${member.email}) ON CONFLICT DO NOTHING`;
    }
  }
  const stateRows=await sql`SELECT state_value FROM bleuprint_workspace_state WHERE workspace_id=${WORKSPACE} AND state_key='calendar' LIMIT 1`;
  const calendar=Array.isArray(stateRows[0]?.state_value)?stateRows[0].state_value:[];
  const normalized=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const nextCalendar=calendar.map(row=>{
    const match=posts.find(post=>row.bufferPostId===post.id||(!row.bufferPostId&&normalized(post.text).includes(normalized(row.title))));
    if(!match)return row;
    const status={sent:"Published",scheduled:"Scheduled",sending:"Scheduled",draft:"Draft",needs_approval:"In approval",error:"Blocked"}[match.status]||row.status;
    return {...row,status,bufferPostId:match.id,bufferStatus:match.status,bufferDueAt:match.dueAt,updatedAt:new Date().toISOString(),updatedBy:"Buffer sync"};
  });
  if(JSON.stringify(nextCalendar)!==JSON.stringify(calendar))await sql`INSERT INTO bleuprint_workspace_state (workspace_id,state_key,state_value,updated_by) VALUES (${WORKSPACE},'calendar',${JSON.stringify(nextCalendar)}::jsonb,'Buffer sync') ON CONFLICT (workspace_id,state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW(),updated_by=EXCLUDED.updated_by`;
  await sql`INSERT INTO bleuprint_audit_events (workspace_id,actor_email,event_type,source_name,detail) VALUES (${WORKSPACE},${member.email},'buffer.synced','Buffer',${JSON.stringify({posts:posts.length,calendarMatches:nextCalendar.filter(row=>row.bufferPostId).length})}::jsonb)`;
  return NextResponse.json({ok:true,posts:posts.length,calendar:nextCalendar});
}
