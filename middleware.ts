import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Temporary: Disable middleware during RBAC testing
  // API routes should handle auth themselves via checkRBAC + getSession
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
