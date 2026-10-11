import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SELECT = {
  mermaId: true,
  productoId: true,
  cantidad: true,
  motivo: true,
  createdAt: true,
  updatedAt: true,
  producto: { select: { id: true, nombre: true, codigoInterno: true } },
} as const;

function mapMerma(m: any) {
  return {
    mermaId: m.mermaId,
    productoId: m.productoId,
    productoNombre: m.producto?.nombre ?? null,
    productoCodigo: m.producto?.codigoInterno ?? null,
    cantidad: Number(m.cantidad),
    motivo: m.motivo ?? "",
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

/**
 * @description Mobile mermas list endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mermas list response.
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
    const mermas = await prisma.merma.findMany({
      where: { tenantId },
      select: SELECT,
      orderBy: { createdAt: "desc" },
    });

    return successResponse({ items: mermas.map(mapMerma) });
  } catch (error) {
    console.error("Error en mobile mermas route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
