import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../lib/db";
import { getServerMember } from "../../../lib/server-member";

const WORKSPACE="passport";
export async function GET(){
  const member=await getServerMember(); if(!member)return NextResponse.json({error:"Unauthorized"},{status:401});
  await ensureSchema(); const sql=getSql();
  const rows=await sql`SELECT id, actor_email, title, body, link, email_state, read_at, created_at FROM bleuprint_notifications WHERE workspace_id=${WORKSPACE} AND recipient_email=${member.email} ORDER BY created_at DESC LIMIT 50`;
  return NextResponse.json({notifications:rows,unread:rows.filter(item=>!item.read_at).length,emailConnected:Boolean(process.env.MICROSOFT_CLIENT_ID&&process.env.MICROSOFT_CLIENT_SECRET&&process.env.MICROSOFT_TENANT_ID)});
}
export async function PATCH(request){
  const member=await getServerMember(); if(!member)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>({})); await ensureSchema(); const sql=getSql();
  if(body.all)await sql`UPDATE bleuprint_notifications SET read_at=COALESCE(read_at,NOW()) WHERE workspace_id=${WORKSPACE} AND recipient_email=${member.email}`;
  else if(body.id)await sql`UPDATE bleuprint_notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=${body.id} AND workspace_id=${WORKSPACE} AND recipient_email=${member.email}`;
  return NextResponse.json({ok:true});
}
