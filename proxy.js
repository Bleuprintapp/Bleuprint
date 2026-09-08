import { NextResponse } from "next/server";

export default function protectPrivateRoutes(request) {
  const path = request.nextUrl.pathname;
  const isPrivate = path.startsWith("/admin") || path.startsWith("/portal");
  if (isPrivate && !request.cookies.get("bleuprint_session")?.value) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt|mp4)).*)",
    "/(api)(.*)"
  ]
};
