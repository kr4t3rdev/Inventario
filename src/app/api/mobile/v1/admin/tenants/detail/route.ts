import { handleAdminRequest } from "../../_shared";
import { getAdminTenantDetail } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Obtiene el detalle completo de una empresa para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer (?tenantId=).
 * @returns {Promise<Response>} Empresa con licencia vigente, miembros y conteos.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      return { tenantId: searchParams.get("tenantId") ?? "" };
    },
    getAdminTenantDetail,
  );
}
