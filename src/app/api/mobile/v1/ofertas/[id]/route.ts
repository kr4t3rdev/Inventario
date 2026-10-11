import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import {
  getOfertaForTenant,
  mapOfertaForMobile,
} from "@/features/ofertas/services/oferta-read-service";

export const dynamic = "force-dynamic";

/**
 * @description Mobile oferta detail endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Oferta detail response.
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
    const oferta = await getOfertaForTenant(id, tenantId);
    if (!oferta) {
      return errorResponse("Oferta no encontrada", 404, "NOT_FOUND");
    }

    return successResponse({ oferta: mapOfertaForMobile(oferta) });
  } catch (error) {
    console.error("Error en mobile oferta detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
