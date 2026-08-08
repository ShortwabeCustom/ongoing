import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/lucia";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json(
      {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
