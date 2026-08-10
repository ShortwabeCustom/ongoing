import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { getDb } from "@/lib/db-lazy";
import { cookies } from "next/headers";

const db = getDb();
const adapter = new PrismaAdapter(db.session, db.user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
    },
    name: "auth_session",
  },
  getUserAttributes: (attributes) => {
    return {
      id: attributes.id,
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
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("auth_session")?.value;

  if (!sessionId) return null;

  const { session, user } = await lucia.validateSession(sessionId);
  return { session, user };
}

export async function createSessionCookie(sessionId: string) {
  const session = await lucia.createSession(sessionId, {});
  const sessionCookie = lucia.createSessionCookie(sessionId);
  return sessionCookie;
}
