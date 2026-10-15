import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * @description Mobile categoria detail endpoint using Bearer <redacted>
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) return authResult as Response;
  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  try {
    const { id } = await params;
    const c = await prisma.categoria.findFirst({
      where: { catId: id, tenantId },
      select: { catId: true, nombre: true, descripcion: true, createdAt: true, updatedAt: true },
    });
    if (!c) return errorResponse("Categoría no encontrada", 404, "NOT_FOUND");
    return successResponse({
      categoria: {
        categoryId: c.catId,
        nombre: c.nombre,
        descripcion: c.descripcion ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en mobile categoria detail:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
