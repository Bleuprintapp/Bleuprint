import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";

export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    connectors: [
      { id: "microsoft", name: "Microsoft 365", state: process.env.MICROSOFT_CLIENT_ID ? "ready-to-authorize" : "needs-app-credentials", mode: "read-only" },
      { id: "google", name: "Google Drive", state: process.env.GOOGLE_CLIENT_ID ? "ready-to-authorize" : "needs-app-credentials", mode: "read-only" },
      { id: "local", name: "Local folders", state: "ready", mode: "signed snapshot sync" },
      { id: "flow", name: "Flow automation", state: process.env.FLOW_CONNECTOR_TOKEN ? "ready" : "needs-token", mode: "event intake" },
      { id: "blkbox", name: "BLKBOX", state: process.env.BLKBOX_WEBHOOK_URL ? "ready" : "needs-webhook", mode: "schedule-only handoff" },
    ],
  });
}
