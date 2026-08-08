import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lucia, getSession } from "@/lib/auth/lucia";
import { verifyPassword, validatePasswordStrength } from "@/lib/auth/password";
import { LoginSchema } from "@/lib/validators/auth";
import { ZodError } from "zod";
import { generateIdFromEntropySize } from "lucia";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input
    const { email, password, rememberMe } = LoginSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        deletedAt: true,
      },
    });

    // User not found or deleted
    if (!user || user.deletedAt || !user.passwordHash) {
      return NextResponse.json(
        {
          code: "INVALID_CREDENTIALS",
          message: "Email o contraseña incorrectos",
        },
        { status: 401 }
      );
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        {
          code: "INVALID_CREDENTIALS",
          message: "Email o contraseña incorrectos",
        },
        { status: 401 }
      );
    }

    // Create session
    const sessionId = generateIdFromEntropySize(25);
    const expiresAt = new Date(
      Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000)
    );

    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt,
      },
    });

    // Get session cookie
    const sessionCookie = lucia.createSessionCookie(sessionId);

    // Create response
    const response = NextResponse.json(
      {
        message: "Login exitoso",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
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
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Datos inválidos",
          fields: Object.fromEntries(
            error.issues.map((issue) => [
              issue.path.join("."),
              issue.message,
            ])
          ),
        },
        { status: 400 }
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
