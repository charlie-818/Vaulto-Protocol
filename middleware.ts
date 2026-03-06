import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Platform routes that require vaulto.ai email
const protectedRoutes = ["/swap", "/mint", "/earn", "/predictions"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Check if accessing a protected platform route
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute) {
    const session = req.auth;

    // Not authenticated - redirect to waitlist
    if (!session?.user) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Authenticated but not a vaulto employee - redirect to waitlist success
    if (!session.user.isVaultoEmployee) {
      return NextResponse.redirect(new URL("/waitlist-success", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/swap/:path*", "/mint/:path*", "/earn/:path*", "/predictions/:path*"],
};
