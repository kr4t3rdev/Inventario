import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile gasto detail endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Gasto detail response.
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
    const g = await prisma.gastosDE.findFirst({
      where: { gastosDEId: id, tenantId },
      include: { concepto: { select: { nombre: true } } },
    });
    if (!g) {
      return errorResponse("Gasto no encontrado", 404, "NOT_FOUND");
    }

    return successResponse({
      gasto: {
        gastoId: g.gastosDEId,
        conceptoId: g.conceptoId ?? "",
        conceptoNombre: g.concepto?.nombre ?? null,
        monto: Number(g.monto),
        descripcion: g.descripcion ?? null,
        comprobante: g.numeroFactura ?? null,
        estado: g.isPagado === "PAGADO" ? "APROBADO" : "REGISTRADO",
        periodo: g.periodo,
        fecha: g.createdAt.toISOString(),
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile gasto detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
