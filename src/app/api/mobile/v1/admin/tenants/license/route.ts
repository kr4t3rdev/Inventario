import { handleAdminRequest } from "../../_shared";
import { getAdminTenantLicense } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Obtiene las licencias de una empresa para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer (?tenantId=).
 * @returns {Promise<Response>} Licencias ordenadas y la vigente.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      return { tenantId: searchParams.get("tenantId") ?? "" };
    },
    getAdminTenantLicense,
  );
}
