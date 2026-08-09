import { NextRequest, NextResponse } from "next/server";
import { idempotencyService } from "@/lib/services/idempotency-service";

export async function idempotencyMiddleware(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const method = request.method;

  // Solo validar mutations
  if (!["POST", "PATCH", "DELETE"].includes(method)) {
    return handler(request);
  }

  // Obtener Idempotency-Key header
  const idempotencyKey = request.headers.get("Idempotency-Key");

  if (!idempotencyKey) {
    return NextResponse.json(
      {
        error: "Idempotency-Key header required for mutations",
        code: "MISSING_IDEMPOTENCY_KEY",
      },
      { status: 400 }
    );
  }

  // Validar formato
  const validation = idempotencyService.validateHeader(idempotencyKey);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: validation.error,
        code: "INVALID_IDEMPOTENCY_KEY",
      },
      { status: 400 }
    );
  }

  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  // Verificar si ya fue procesado
  const { isDuplicate, response: cachedResponse } =
    await idempotencyService.checkDuplicate(endpoint, method, endpoint);

  if (isDuplicate) {
    return NextResponse.json(
      {
        code: "DUPLICATE_REQUEST",
        message: "Request already processed",
        data: {
          cached_response: cachedResponse,
        },
      },
      { status: 409 }
    );
  }

  // Procesar request
  const response = await handler(request);

  // Guardar en store idempotency si fue exitoso
  if (response.status === 200 || response.status === 201) {
    try {
      const responseBody = await response.clone().json();
      await idempotencyService.storeResponse(
        idempotencyKey,
        method,
        endpoint,
        response.status,
        responseBody
      );
    } catch (err) {
      console.error("Failed to store idempotency response:", err);
      // Continuar aunque falle el almacenamiento
    }
  }

  return response;
}
