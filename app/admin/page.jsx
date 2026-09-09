import { redirect } from "next/navigation";
import { getServerMember } from "../../lib/server-member";
import PortalShell from "./portal-shell";

export const dynamic = "force-dynamic";

export default async function AdminPortal() {
  const member = await getServerMember();
  if (!member) redirect("/sign-in");
  return <PortalShell member={member} />;
}
