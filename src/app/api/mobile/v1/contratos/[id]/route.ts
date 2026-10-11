import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ESTADO_MAP: Record<string, string> = { ANULADO: "CANCELADO" };

/**
 * @description Mobile contrato detail endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Contrato detail response.
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
    const c = await prisma.contrato.findFirst({
      where: { contratoId: id, tenantId },
      include: { cliente: { select: { nombre: true } } },
    });
    if (!c) {
      return errorResponse("Contrato no encontrado", 404, "NOT_FOUND");
    }

    return successResponse({
      contrato: {
        contratoId: c.contratoId,
        clienteId: c.clienteId,
        clienteNombre: c.cliente?.nombre ?? null,
        numeroContrato: c.numeroContrato,
        observaciones: c.observaciones ?? null,
        monto: Number(c.monto ?? 0),
        estado: ESTADO_MAP[c.estado] ?? c.estado,
        fechaInicio: c.fechaInicio.toISOString(),
        fechaFin: c.fechaFin ? c.fechaFin.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile contrato detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
