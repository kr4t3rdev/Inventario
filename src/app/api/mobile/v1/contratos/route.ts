import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ESTADO_MAP: Record<string, string> = { ANULADO: "CANCELADO" };

function mapContrato(c: any) {
  return {
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
  };
}

const SELECT = {
  contratoId: true,
  clienteId: true,
  numeroContrato: true,
  observaciones: true,
  monto: true,
  estado: true,
  fechaInicio: true,
  fechaFin: true,
  createdAt: true,
  updatedAt: true,
  cliente: { select: { nombre: true } },
} as const;

/**
 * @description Mobile contratos list endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Contratos list response.
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
    const contratos = await prisma.contrato.findMany({
      where: { tenantId },
      select: SELECT,
      orderBy: { createdAt: "desc" },
    });

    return successResponse({ items: contratos.map(mapContrato) });
  } catch (error) {
    console.error("Error en mobile contratos route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
