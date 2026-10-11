import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { listFacturasForTenant } from "@/features/facturas/services/factura-read-service";

export const dynamic = "force-dynamic";

/**
 * @description Mobile facturas list endpoint using Bearer <redacted>
 * @param {Request} request - Incoming authenticated request with optional filters.
 * @returns {Promise<Response>} Facturas list response.
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
    const result = await listFacturasForTenant(tenantId, {
      search: searchParams.get("search") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
      tipoDocumento: searchParams.get("tipoDocumento") ?? undefined,
      clienteId: searchParams.get("clienteId") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    });

    return successResponse(result);
  } catch (error) {
    console.error("Error en mobile facturas route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}
