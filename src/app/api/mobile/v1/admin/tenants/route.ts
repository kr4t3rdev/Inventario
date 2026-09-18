import { handleAdminRequest } from "../_shared";
import { getAdminTenants } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Lista empresas (tenants reales) con plan y conteo de usuarios para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Lista de tenants.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async () => undefined,
    getAdminTenants,
  );
}