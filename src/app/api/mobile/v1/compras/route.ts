import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile compras list endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request with optional filters.
 * @returns {Promise<Response>} Compras list response.
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
    const search = searchParams.get("search") ?? undefined;
    const estado = searchParams.get("estado") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (estado) where.estado = estado;
    if (search) {
      where.OR = [
        { numeroFactura: { contains: search, mode: "insensitive" } },
        { items: { some: { producto: { nombre: { contains: search, mode: "insensitive" } } } } },
        { proveedor: { nombre: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [compras, total] = await Promise.all([
      prisma.compraDocumento.findMany({
        where,
        include: {
          proveedor: { select: { vendorId: true, nombre: true } },
          items: { include: { producto: { select: { id: true, nombre: true } } } },
        },
        orderBy: { fechaCompra: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.compraDocumento.count({ where }),
    ]);

    const items = compras.map((c) => ({
      compraId: c.id,
      numeroFactura: c.numeroFactura,
      proveedorId: c.proveedorId,
      proveedorNombre: c.proveedor?.nombre ?? null,
      fechaCompra: c.fechaCompra?.toISOString() ?? null,
      estado: c.estado,
      tipoOperacion: c.tipoOperacion ?? null,
      formaPago: c.formaPago ?? null,
      subtotal: Number(c.subtotal),
      impuestos: Number(c.impuestos ?? 0),
      total: Number(c.total),
      createdAt: c.createdAt.toISOString(),
    }));

    return successResponse({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error en mobile compras route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
