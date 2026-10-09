import { handleAdminRequest } from "../../_shared";
import { getAdminTenantUsers } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Lista los usuarios pertenecientes a una empresa para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer (?tenantId=).
 * @returns {Promise<Response>} Miembros con sus datos y total.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      return { tenantId: searchParams.get("tenantId") ?? "" };
    },
    getAdminTenantUsers,
  );
}
