import { handleAdminRequest } from "../../_shared";
import { getAdminPendingMemberships } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Lista membresías pendientes de aprobación para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Membresías pendientes.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async () => undefined,
    getAdminPendingMemberships,
  );
}