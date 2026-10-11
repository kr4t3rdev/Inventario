import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile transferencia detail endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Transferencia detail response.
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
    const t = await prisma.transferencia.findFirst({
      where: { transferenciaId: id, tenantId, deletedAt: null },
      include: {
        producto: { select: { nombre: true, codigoInterno: true } },
        origen: { select: { nombre: true } },
        destino: { select: { nombre: true } },
        puntoDeVentaOrigen: { select: { nombre: true } },
        puntoDeVentaDestino: { select: { nombre: true } },
        creadoPor: { select: { name: true } },
      },
    });
    if (!t) {
      return errorResponse("Transferencia no encontrada", 404, "NOT_FOUND");
    }

    return successResponse({
      transferencia: {
        transferenciaId: t.transferenciaId,
        numeroTransferencia: t.numeroTransferencia,
        productoId: t.productoId,
        productoNombre: t.producto.nombre,
        productoCodigo: t.producto.codigoInterno ?? null,
        cantidad: Number(t.cantidad),
        costoUnitario: Number(t.costoUnitario ?? 0),
        costoTotal: Number(t.costoTotal ?? 0),
        origenNombre: t.origen?.nombre ?? t.puntoDeVentaOrigen?.nombre ?? null,
        destinoNombre: t.destino?.nombre ?? t.puntoDeVentaDestino?.nombre ?? null,
        estado: t.estado,
        motivo: (t as Record<string, unknown>).motivo ?? null,
        observaciones: (t as Record<string, unknown>).observaciones ?? null,
        creadoPorNombre: t.creadoPor?.name ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile transferencia detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
