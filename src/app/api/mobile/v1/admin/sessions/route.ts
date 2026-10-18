import { handleAdminRequest } from "../_shared";
import { getAdminSessions } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Lista las sesiones registradas para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Sesiones ordenadas por fecha descendente.
 */
export async function GET(request: Request) {
  return handleAdminRequest(request, async () => ({}), getAdminSessions);
}
