import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function mapCategoria(c: any) {
  return {
    categoryId: c.catId,
    nombre: c.nombre,
    descripcion: c.descripcion ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

const SELECT = {
  catId: true,
  nombre: true,
  descripcion: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile categorias list endpoint using Bearer <redacted>
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) return authResult as Response;
  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  try {
    const categorias = await prisma.categoria.findMany({
      where: { tenantId },
      select: SELECT,
      orderBy: { nombre: "asc" },
    });
    return successResponse({ items: categorias.map(mapCategoria) });
  } catch (error) {
    console.error("Error en mobile categorias route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
