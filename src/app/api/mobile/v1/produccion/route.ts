import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile produccion ordenes list endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request with optional filters.
 * @returns {Promise<Response>} Ordenes list response.
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
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get("estado") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

    const where: Record<string, unknown> = { tenantId };
    if (estado) where.estado = estado;

    const [ordenes, total] = await Promise.all([
      prisma.ordenProduccion.findMany({
        where,
        include: {
          Receta: {
            include: {
              Producto: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ordenProduccion.count({ where }),
    ]);

    const items = ordenes.map((o) => ({
      ordenId: o.ordenProduccionId,
      recetaId: o.recetaId,
      recetaNombre: o.Receta?.nombre ?? null,
      productoNombre: o.Receta?.Producto?.nombre ?? null,
      cantidad: o.cantidad,
      estado: o.estado,
      fechaProduccion: o.fechaProduccion.toISOString(),
      costoMateriales: o.costoMateriales ?? null,
      createdAt: o.createdAt.toISOString(),
    }));

    return successResponse({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error en mobile produccion route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
