import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function mapListaPrecio(l: any) {
  return {
    listaId: l.id,
    nombre: l.nombre,
    descripcion: l.descripcion ?? null,
    esDefault: l.esDefault ?? false,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

/**
 * @description Mobile listas-precios list endpoint using Bearer <redacted>
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) return authResult as Response;
  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse("Tenant no identificado", 403, "TENANT_REQUIRED");
  try {
    const listas = await prisma.listaPrecio.findMany({
      where: { tenantId },
      orderBy: { nombre: "asc" },
    });
    return successResponse({ items: listas.map(mapListaPrecio) });
  } catch (error) {
    console.error("Error en mobile listas-precios route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
