import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function mapGasto(g: any) {
  return {
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
  };
}

/**
 * @description Mobile gastos list endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request with optional filters.
 * @returns {Promise<Response>} Gastos list response.
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
    const where: Record<string, unknown> = { tenantId };
    const conceptoId = searchParams.get("conceptoId");
    if (conceptoId) where.conceptoId = conceptoId;
    const fecha = searchParams.get("fecha");
    if (fecha) {
      const day = new Date(fecha);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      where.createdAt = { gte: day, lt: next };
    }
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

    const [rows, total] = await Promise.all([
      prisma.gastosDE.findMany({
        where,
        include: { concepto: { select: { nombre: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.gastosDE.count({ where }),
    ]);

    return successResponse({
      items: rows.map(mapGasto),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error en mobile gastos route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
