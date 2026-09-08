import PortalShell from "./portal-shell";
import { redirect } from "next/navigation";
import { getServerMember } from "../../lib/server-member";

export const dynamic = "force-dynamic";

export default async function AdminPortal() {
  const member = await getServerMember();
  if (!member) redirect("/not-authorized");
  return <PortalShell member={member} />;
}
