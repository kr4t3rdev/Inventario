import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile reparacion orden detail endpoint using Bearer <redacted>
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
    const o = await prisma.ordenReparacion.findFirst({
      where: { id, tenantId },
      include: {
        cliente: { select: { nombre: true, telefono: true } },
        equipoTipo: { select: { nombre: true } },
        tecnico: { select: { nombre: true, apellido: true } },
      },
    });
    if (!o) {
      return errorResponse("Orden no encontrada", 404, "NOT_FOUND");
    }

    return successResponse({
      orden: {
        ordenId: o.id,
        numeroOrden: o.numeroOrden,
        clienteNombre: o.cliente?.nombre ?? null,
        clienteTelefono: o.cliente?.telefono ?? null,
        equipoTipo: o.equipoTipo?.nombre ?? null,
        marca: o.marca,
        modelo: o.modelo ?? null,
        numeroSerie: o.numeroSerie ?? null,
        accesorios: o.accesorios ?? null,
        problemaReportado: o.problemaReportado,
        diagnosticoTecnico: o.diagnosticoTecnico ?? null,
        estado: o.estado,
        prioridad: o.prioridad,
        esGarantia: o.esGarantia,
        tecnicoNombre: o.tecnico ? `${o.tecnico.nombre} ${o.tecnico.apellido ?? ""}`.trim() : null,
        fechaRecepcion: o.fechaRecepcion.toISOString(),
        fechaEstimada: o.fechaEstimada?.toISOString() ?? null,
        fechaEntrega: o.fechaEntrega?.toISOString() ?? null,
        subtotal: Number(o.subtotal ?? 0),
        createdAt: o.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile reparacion detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
