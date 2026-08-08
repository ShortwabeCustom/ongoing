import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { UpdateUserSchema } from "@/lib/validators/auth";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/lucia";

type Params = {
  id: string;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "No autenticado" },
        { status: 401 }
      );
    }

    // Check permissions: can update own profile or OWNER can update anyone
    const canUpdate =
      session.user.id === id || session.user.role === "OWNER";

    if (!canUpdate) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "No tienes permiso para actualizar este usuario",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const update = UpdateUserSchema.parse(body);

    // Hash password if provided
    const data: any = { ...update };
    if (update.password) {
      data.passwordHash = await hashPassword(update.password);
      delete data.password;
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "Usuario actualizado exitosamente",
        user,
      },
      { status: 200 }
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

    console.error("Update user error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "No autenticado" },
        { status: 401 }
      );
    }

    // Only OWNER can delete users
    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "No tienes permiso para eliminar usuarios",
        },
        { status: 403 }
      );
    }

    // Soft delete
    const user = await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json(
      {
        message: "Usuario eliminado exitosamente",
        user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
