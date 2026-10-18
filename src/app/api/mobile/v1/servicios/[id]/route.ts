import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile servicio detail endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Servicio detail response.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  }

  try {
    const { id } = await params;
    const s = await prisma.servicios.findFirst({
      where: { servicioId: id, tenantId },
    });
    if (!s) {
      return errorResponse("Servicio no encontrado", 404, "NOT_FOUND");
    }

    return successResponse({
      servicio: {
        servicioId: s.servicioId,
        nombre: s.nombre,
        descripcion: s.descripcion,
        precio: Number(s.precio),
        moneda: s.moneda,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile servicio detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
