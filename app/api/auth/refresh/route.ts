import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/lucia";
import { prisma } from "@/lib/prisma";
import { lucia } from "@/lib/auth/lucia";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.session || !session?.user) {
      return NextResponse.json(
        { code: "NO_SESSION", message: "No hay sesión activa" },
        { status: 401 }
      );
    }

    // Renew session expiry (8 more hours or 30 days if remember me)
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await prisma.session.update({
      where: { id: session.session.id },
      data: { expiresAt },
    });

    const sessionCookie = lucia.createSessionCookie(session.session.id);

    const response = NextResponse.json(
      {
        message: "Sesión renovada",
        user: session.user,
      },
      { status: 200 }
    );

    response.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    return response;
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
