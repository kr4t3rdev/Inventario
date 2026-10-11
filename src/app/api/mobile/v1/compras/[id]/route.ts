import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile compra detail endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Compra detail response.
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
    const compra = await prisma.compraDocumento.findFirst({
      where: { compraDocumentoId: id, tenantId, deletedAt: null },
      include: {
        proveedor: { select: { vendorId: true, nombre: true } },
        items: { include: { producto: { select: { id: true, nombre: true } } } },
      },
    });
    if (!compra) {
      return errorResponse("Compra no encontrada", 404, "NOT_FOUND");
    }

    return successResponse({
      compra: {
        compraId: compra.id,
        numeroFactura: compra.numeroFactura,
        proveedorId: compra.proveedorId,
        proveedorNombre: compra.proveedor?.nombre ?? null,
        fechaCompra: compra.fechaCompra?.toISOString() ?? null,
        estado: compra.estado,
        tipoOperacion: compra.tipoOperacion ?? null,
        formaPago: compra.formaPago ?? null,
        subtotal: Number(compra.subtotal),
        impuestos: Number(compra.impuestos ?? 0),
        descuento: Number(compra.descuento ?? 0),
        total: Number(compra.total),
        observaciones: compra.observaciones ?? null,
        items: compra.items.map((item) => ({
          itemId: item.id,
          productoId: item.productoId,
          productoNombre: item.producto?.nombre ?? null,
          cantidad: Number(item.cantidad),
          precioUnitario: Number(item.precioUnitario),
          subtotal: Number(item.subtotal),
        })),
        createdAt: compra.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile compra detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
