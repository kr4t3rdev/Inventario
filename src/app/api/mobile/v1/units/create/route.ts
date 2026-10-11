import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile unit create endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request with { nombre, simbolo }.
 * @returns {Promise<Response>} Created unit response.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  }

  try {
    const body = await request.json();
    const { nombre, simbolo } = body;

    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      return errorResponse("El nombre es requerido", 400, "VALIDATION_ERROR");
    }

    const unit = await prisma.unidad.create({
      data: {
        tenantId,
        nombre: nombre.trim(),
        simbolo: simbolo?.trim() || null,
      },
      select: { unidadId: true, nombre: true, simbolo: true },
    });

    return successResponse({ unit }, 201);
  } catch (error) {
    console.error("Error en mobile units create route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
