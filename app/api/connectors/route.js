import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";
import { configState } from "../../../lib/microsoft";

export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    connectors: [
      { id: "microsoft", name: "Microsoft 365", state: configState().ready ? "ready-to-authorize" : "needs-app-credentials", mode: "OneDrive files, delegated access as the signed-in user" },
      { id: "buffer", name: "Buffer", state: process.env.BUFFER_API_KEY ? "ready" : "needs-api-key", mode: "publishing status + provisional performance metrics" },
      { id: "local", name: "Uploaded folders", state: "ready", mode: "manual source snapshots until Microsoft authorization" },
      { id: "flow", name: "Flow automation", state: process.env.FLOW_CONNECTOR_TOKEN ? "ready" : "needs-token", mode: "event intake" },
      { id: "blkbox", name: "BLKBOX", state: process.env.BLKBOX_WEBHOOK_URL ? "ready" : "needs-webhook", mode: "schedule-only handoff" },
    ],
  });
}
