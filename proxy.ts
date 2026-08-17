import { NextResponse, type NextRequest } from "next/server";

/**
 * Rutas de página que exigen sesión (C-03).
 *
 * Barrera previa y OPTIMISTA: aquí solo se comprueba la PRESENCIA de la cookie de
 * sesión, no su validez (validarla requiere PostgreSQL, fuera del alcance de esta capa).
 * La comprobación autoritativa sigue estando en cada página (`requirePageSession()` /
 * `getSession()`) y en cada route handler (`checkRBAC`).
 *
 * Aporta dos cosas que la comprobación de página no puede dar por sí sola:
 *  1. Un 307 HTTP real para el anónimo. `/dashboard/analytics` tiene `loading.tsx`, de modo
 *     que Next ya ha emitido 200 + el shell HTML antes de que el componente de servidor
 *     pueda llamar a `redirect()` (comprobado en producción: anónimo -> 200).
 *  2. Un único sitio donde declarar qué prefijos de página son privados.
 */
const PROTECTED_PREFIXES = [
  "/findings",
  "/search",
  "/test-import",
  "/dashboard",
  "/profile",
];

const SESSION_COOKIE = "auth_session";

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtected(pathname) && !request.cookies.get(SESSION_COOKIE)?.value) {
    const loginUrl = new URL("/login", request.nextUrl);
    return NextResponse.redirect(loginUrl, 307);
  }

  // El resto (incluido el informe público de `/` y `/api/**`) pasa sin cambios:
  // los route handlers siguen aplicando auth/RBAC por su cuenta.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
