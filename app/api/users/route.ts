import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { RegisterSchema } from "@/lib/validators/auth";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/lucia";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // Only OWNER can create users
    if (!session?.user || session.user.role !== "OWNER") {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "No tienes permiso para crear usuarios" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, name, password } = RegisterSchema.parse(body);

    // Check password strength
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json(
        {
          code: "WEAK_PASSWORD",
          message: "Contraseña débil",
          errors: strength.errors,
        },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          code: "USER_EXISTS",
          message: "Este email ya está registrado",
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "VIEWER", // Default role
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "Usuario creado exitosamente",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Datos inválidos",
          fields: Object.fromEntries(
            error.issues.map((issue) => [issue.path.join("."), issue.message])
          ),
        },
        { status: 400 }
      );
    }

    console.error("Create user error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "No autenticado" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20"));
    const offset = (page - 1) * limit;

    // Only OWNER and QA_LEAD can list users
    const canListAll =
      session.user.role === "OWNER" || session.user.role === "QA_LEAD";

    const where = {
      deletedAt: null,
      ...(canListAll ? {} : { id: session.user.id }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json(
      {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
