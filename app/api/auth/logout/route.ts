import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lucia, getSession } from "@/lib/auth/lucia";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.session) {
      return NextResponse.json(
        { code: "NO_SESSION", message: "No hay sesión activa" },
        { status: 401 }
      );
    }

    // Invalidate session in database
    await prisma.session.delete({
      where: { id: session.session.id },
    });

    // Clear session cookie
    const sessionCookie = lucia.createBlankSessionCookie();

    const response = NextResponse.json(
      { message: "Logout exitoso" },
      { status: 200 }
    );

    response.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
