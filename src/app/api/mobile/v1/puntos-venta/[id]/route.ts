import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile punto-venta detail endpoint using Bearer <redacted>
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) return authResult as Response;
  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  try {
    const { id } = await params;
    const pv = await prisma.puntoDeVenta.findFirst({
      where: { pvId: id, tenantId },
      include: { listaPrecio: { select: { nombre: true } } },
    });
    if (!pv) return errorResponse("Punto de venta no encontrado", 404, "NOT_FOUND");
    return successResponse({
      puntoVenta: {
        pvId: pv.pvId,
        nombre: pv.nombre,
        ubicacion: (pv as any).ubicacion ?? null,
        tipoCaja: (pv as any).tipoCaja ?? null,
        listaPrecioNombre: pv.listaPrecio?.nombre ?? null,
        createdAt: pv.createdAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Error en mobile punto-venta detail:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
