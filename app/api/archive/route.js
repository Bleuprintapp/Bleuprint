import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../lib/db";
import { getServerMember } from "../../../lib/server-member";

const WORKSPACE="passport";
export async function GET(){
  const member=await getServerMember(); if(!member)return NextResponse.json({error:"Unauthorized"},{status:401});
  await ensureSchema(); const sql=getSql();
  const [documents,memory,issues,events,stateRows]=await Promise.all([
    sql`SELECT id,name,document_type,destination,archived_at,archived_by FROM bleuprint_documents WHERE workspace_id=${WORKSPACE} AND archived_at IS NOT NULL ORDER BY archived_at DESC`,
    sql`SELECT id,area,title,body,source_name,source_location,archived_at,archived_by FROM bleuprint_memory_entries WHERE workspace_id=${WORKSPACE} AND archived_at IS NOT NULL ORDER BY archived_at DESC`,
    sql`SELECT id,mismatch_type,detail,source_location,status,resolution_note,resolved_by,resolved_at,assigned_to,impact FROM bleuprint_mismatches WHERE workspace_id=${WORKSPACE} AND status IN ('resolved','dismissed','archived') ORDER BY COALESCE(resolved_at,created_at) DESC`,
    sql`SELECT id,actor_email,event_type,source_name,source_location,detail,created_at FROM bleuprint_audit_events WHERE workspace_id=${WORKSPACE} ORDER BY created_at DESC LIMIT 250`,
    sql`SELECT state_value FROM bleuprint_workspace_state WHERE workspace_id=${WORKSPACE} AND state_key='calendar' LIMIT 1`,
  ]);
  const calendar=Array.isArray(stateRows[0]?.state_value)?stateRows[0].state_value:[];
  const content=calendar.filter(row=>["Archived","Approved","Published","Done"].includes(row.status)).map(row=>({id:row.id,type:"Content",title:row.title,status:row.status,document:row.sourceDocument||"Content calendar",location:`${row.date||row.day||"No date"} · ${row.channel||"No channel"}`,approvedBy:row.updatedBy||row.owner||"Team",at:row.updatedAt||null}));
  return NextResponse.json({documents,memory,issues,events,content});
}

export async function PATCH(request){
  const member=await getServerMember(); if(!member)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>({})); if(!body.id||!body.type)return NextResponse.json({error:"Archive item id and type are required"},{status:400});
  await ensureSchema(); const sql=getSql();
  if(body.type==="document"){
    await sql`UPDATE bleuprint_documents SET archived_at=NULL, archived_by=NULL WHERE id=${body.id} AND workspace_id=${WORKSPACE}`;
    await sql`UPDATE bleuprint_memory_entries SET archived_at=NULL, archived_by=NULL, status='extracted', updated_at=NOW(), updated_by=${member.email} WHERE source_document_id=${body.id} AND workspace_id=${WORKSPACE}`;
  } else if(body.type==="memory") await sql`UPDATE bleuprint_memory_entries SET archived_at=NULL, archived_by=NULL, status='extracted', updated_at=NOW(), updated_by=${member.email} WHERE id=${body.id} AND workspace_id=${WORKSPACE}`;
  else if(body.type==="issue") await sql`UPDATE bleuprint_mismatches SET status='open', resolution_note=NULL, resolved_by=NULL, resolved_at=NULL WHERE id=${body.id} AND workspace_id=${WORKSPACE}`;
  else return NextResponse.json({error:"Unsupported archive item"},{status:400});
  await sql`INSERT INTO bleuprint_audit_events (workspace_id,actor_email,event_type,source_name,detail) VALUES (${WORKSPACE},${member.email},'archive.restored',${body.type},${JSON.stringify({id:body.id})}::jsonb)`;
  return NextResponse.json({ok:true});
}
