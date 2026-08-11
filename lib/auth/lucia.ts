import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { getDb } from "@/lib/db-lazy";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/generated/prisma/client";

const db = getDb();
const adapter = new PrismaAdapter(db.session, db.user);

type LuciaUserAttributes = {
  email: string;
  name: string;
  role: UserRole;
};

export const lucia = new Lucia<Record<never, never>, LuciaUserAttributes>(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
    name: "auth_session",
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      name: attributes.name,
      role: attributes.role,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  email: string;
  name: string;
  role: UserRole;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("auth_session")?.value;

  if (!sessionId) return null;

  const { session, user } = await lucia.validateSession(sessionId);
  return { session, user };
}

export async function createSessionCookie(sessionId: string) {
  const sessionCookie = lucia.createSessionCookie(sessionId);
  return sessionCookie;
}
