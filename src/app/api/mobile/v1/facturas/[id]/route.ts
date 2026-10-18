import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getFacturaForTenant } from "@/features/facturas/services/factura-read-service";

export const dynamic = "force-dynamic";

/**
 * @description Mobile factura detail endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Factura detail response.
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
    const factura = await getFacturaForTenant(tenantId, id);
    if (!factura) {
      return errorResponse("Factura no encontrada", 404, "NOT_FOUND");
    }

    return successResponse({ factura });
  } catch (error) {
    console.error("Error en mobile factura detail route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
