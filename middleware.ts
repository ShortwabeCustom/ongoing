import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lucia } from "@/lib/auth/lucia";
import { cookies } from "next/headers";

const PUBLIC_ROUTES = ["/login", "/", "/api/auth/login"];
const PROTECTED_ROUTES = ["/findings", "/profile", "/admin"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow API auth routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check for session on protected routes
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(lucia.sessionCookie.name)?.value;

    if (!sessionId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const { session } = await lucia.validateSession(sessionId);

      if (!session) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      // Session is valid
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
