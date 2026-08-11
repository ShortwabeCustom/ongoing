import { NextResponse } from "next/server";

export function proxy() {
  // Route handlers enforce auth/RBAC; proxy remains a lightweight pass-through.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
