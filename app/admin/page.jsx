import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import PortalShell from "./portal-shell";

export const dynamic = "force-dynamic";

function emailFor(user) {
  return user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase() || "";
}

export default async function AdminPortal() {
  if (process.env.NODE_ENV !== "development") {
    const user = await currentUser();
    if (emailFor(user) !== "kalenagardner07@gmail.com") redirect("/portal");
  }

  return <PortalShell />;
}
