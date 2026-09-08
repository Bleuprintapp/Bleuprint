import { auth, currentUser } from "@clerk/nextjs/server";
import { memberForEmail } from "./members";

export async function getServerMember() {
  if (process.env.NODE_ENV === "development") return memberForEmail("kgardner@discoverultrium.com");
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = user?.emailAddresses.find(item => item.id === user.primaryEmailAddressId)?.emailAddress;
  return memberForEmail(email);
}
