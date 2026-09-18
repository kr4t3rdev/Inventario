import { handleAdminRequest } from "../_shared";
import { getAdminUsers } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Lista usuarios globales (admin) o de un tenant (manager) para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Lista de usuarios y total.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      const limit = searchParams.get("limit");
      return {
        tenantId: searchParams.get("tenantId") ?? undefined,
        limit: limit ? Number(limit) : undefined,
      };
    },
    getAdminUsers,
  );
}