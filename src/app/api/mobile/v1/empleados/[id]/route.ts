import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile empleado detail endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Empleado detail response.
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
    const e = await prisma.empleado.findFirst({
      where: { empleadoId: id, tenantId },
    });
    if (!e) {
      return errorResponse("Empleado no encontrado", 404, "NOT_FOUND");
    }

    return successResponse({
      empleado: {
        empleadoId: e.empleadoId,
        nombre: e.nombre,
        apellido: e.apellido,
        telefono: e.telefono ?? null,
        cargo: e.cargo,
        salarioBases: e.salarioBases,
        comisionPct: e.comisionPct,
        metaMensual: e.metaMensual,
        fechaContratacion: e.fechaContratacion.toISOString(),
        esTiempoCompleto: e.esTiempoCompleto,
        diasVacacionesAnuales: e.diasVacacionesAnuales,
        vacationDaysAccrued: e.vacationDaysAccrued,
        vacationDaysUsed: e.vacationDaysUsed,
        createdAt: e.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile empleado detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
