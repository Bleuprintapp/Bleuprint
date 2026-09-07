import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import OperatingSystem from "./operating-system";

export const dynamic = "force-dynamic";

function emailFor(user) {
  return user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase() || "";
}

export default async function AdminPortal() {
  if (process.env.NODE_ENV === "development") {
    return <OperatingSystem firstName="Kalena" />;
  }
  const user = await currentUser();
  if (emailFor(user) !== "kalenagardner07@gmail.com") redirect("/portal");
  return <OperatingSystem firstName={user?.firstName || "Kalena"} />;
}
