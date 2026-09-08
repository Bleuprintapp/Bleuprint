import { redirect } from "next/navigation";
import { getServerMember } from "../../lib/server-member";
import ContentStudio from "./studio";

export const dynamic = "force-dynamic";
export default async function ContentStudioPage() {
  const member = await getServerMember();
  if (!member) redirect("/sign-in");
  return <ContentStudio member={member} />;
}
