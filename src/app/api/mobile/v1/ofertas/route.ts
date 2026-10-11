import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import {
  listOfertasForTenant,
  mapOfertaForMobile,
} from "@/features/ofertas/services/oferta-read-service";

export const dynamic = "force-dynamic";

/**
 * @description Mobile ofertas list endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Ofertas list response.
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
    const ofertas = await listOfertasForTenant(tenantId);
    return successResponse({ items: ofertas.map(mapOfertaForMobile) });
  } catch (error) {
    console.error("Error en mobile ofertas route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
