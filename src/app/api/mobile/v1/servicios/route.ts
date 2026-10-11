import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile servicios list endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Servicios list response.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  }

  try {
    const servicios = await prisma.servicios.findMany({
      where: { tenantId },
      orderBy: { nombre: "asc" },
    });

    const items = servicios.map((s) => ({
      servicioId: s.servicioId,
      nombre: s.nombre,
      descripcion: s.descripcion,
      precio: Number(s.precio),
      moneda: s.moneda,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    return successResponse({ items });
  } catch (error) {
    console.error("Error en mobile servicios route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
