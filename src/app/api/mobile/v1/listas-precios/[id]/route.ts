import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile lista-precio detail endpoint using Bearer <redacted>
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) return authResult as Response;
  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  try {
    const { id } = await params;
    const l = await prisma.listaPrecio.findFirst({
      where: { id, tenantId },
      include: { precios: { include: { producto: { select: { id: true, nombre: true } } } } },
    });
    if (!l) return errorResponse("Lista de precio no encontrada", 404, "NOT_FOUND");
    return successResponse({
      listaPrecio: {
        listaId: l.id,
        nombre: l.nombre,
        descripcion: l.descripcion ?? null,
        esDefault: l.esDefault ?? false,
        precios: l.precios.map((p: any) => ({
          productoId: p.productoId,
          productoNombre: p.producto?.nombre ?? null,
          precio: Number(p.precio),
        })),
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile lista-precio detail:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
