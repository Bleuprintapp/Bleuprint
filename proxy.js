import { NextResponse } from "next/server";

const ACCESS_HASH = "e226a951e38948ae98181a9d9e1f5c93f4b447c667ce4c4143d1ed6ba4cccd6a";

async function hash(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export default async function protectPrivateRoutes(request) {
  if (process.env.NODE_ENV === "development") return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/admin") && !path.startsWith("/portal")) return NextResponse.next();
  const passphrase = request.cookies.get("bleuprint_access")?.value || "";
  if (passphrase && await hash(passphrase) === ACCESS_HASH) return NextResponse.next();
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt|mp4)).*)",
    "/(api)(.*)"
  ]
};
