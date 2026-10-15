import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function mapPuntoVenta(pv: any) {
  return {
    pvId: pv.pvId,
    nombre: pv.nombre,
    ubicacion: pv.ubicacion ?? null,
    tipoCaja: pv.tipoCaja ?? null,
    listaPrecioNombre: pv.listaPrecio?.nombre ?? null,
    createdAt: pv.createdAt?.toISOString() ?? null,
  };
}

/**
 * @description Mobile puntos-venta list endpoint using Bearer <redacted>
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) return authResult as Response;
  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  try {
    const puntos = await prisma.puntoDeVenta.findMany({
      where: { tenantId },
      include: { listaPrecio: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    });
    return successResponse({ items: puntos.map(mapPuntoVenta) });
  } catch (error) {
    console.error("Error en mobile puntos-venta route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
