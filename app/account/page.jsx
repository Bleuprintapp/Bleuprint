import { redirect } from "next/navigation";
import { getServerMember } from "../../lib/server-member";
import AccountForm from "./account-form";

export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const member = await getServerMember();
  if (!member) redirect("/sign-in");
  return <AccountForm member={member} />;
}
