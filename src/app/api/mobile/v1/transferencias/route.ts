import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile transferencias list endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request with optional filters.
 * @returns {Promise<Response>} Transferencias list response.
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

    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (estado) where.estado = estado;

    const [transferencias, total] = await Promise.all([
      prisma.transferencia.findMany({
        where,
        select: {
          transferenciaId: true,
          numeroTransferencia: true,
          productoId: true,
          cantidad: true,
          costoUnitario: true,
          costoTotal: true,
          estado: true,
          createdAt: true,
          updatedAt: true,
          producto: { select: { nombre: true, codigoInterno: true } },
          origen: { select: { almacenId: true, nombre: true } },
          destino: { select: { almacenId: true, nombre: true } },
          puntoDeVentaOrigen: { select: { pvId: true, nombre: true } },
          puntoDeVentaDestino: { select: { pvId: true, nombre: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transferencia.count({ where }),
    ]);

    const items = transferencias.map((t) => ({
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
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return successResponse({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error en mobile transferencias route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
