import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/portal(.*)", "/admin(.*)"]);

const protectPrivateRoutes = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect({ unauthenticatedUrl: "/sign-in" });
  }
});

export default process.env.NODE_ENV === "development"
  ? function localPreview() {}
  : protectPrivateRoutes;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt|mp4)).*)",
    "/(api)(.*)"
  ]
};
