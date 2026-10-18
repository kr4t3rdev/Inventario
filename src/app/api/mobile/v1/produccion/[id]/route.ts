import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile produccion orden detail endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Orden detail response.
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
    const o = await prisma.ordenProduccion.findFirst({
      where: { ordenProduccionId: id, tenantId },
      include: {
        Receta: {
          include: {
            Producto: { select: { id: true, nombre: true } },
            RecetaIngrediente: {
              include: {
                Producto: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    });
    if (!o) {
      return errorResponse("Orden no encontrada", 404, "NOT_FOUND");
    }

    return successResponse({
      orden: {
        ordenId: o.ordenProduccionId,
        recetaId: o.recetaId,
        recetaNombre: o.Receta?.nombre ?? null,
        productoNombre: o.Receta?.Producto?.nombre ?? null,
        cantidad: o.cantidad,
        estado: o.estado,
        observaciones: o.observaciones ?? null,
        fechaProduccion: o.fechaProduccion.toISOString(),
        costoMateriales: o.costoMateriales ?? null,
        ingredientes: o.Receta?.RecetaIngrediente.map((ing) => ({
          productoNombre: ing.Producto?.nombre ?? null,
          cantidad: Number(ing.cantidad),
        })) ?? [],
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile produccion detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
