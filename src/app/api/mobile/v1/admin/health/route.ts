import { handleAdminRequest } from "../_shared";
import { getAdminHealth } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Métricas globales de salud del sistema para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Métricas de salud.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async () => undefined,
    getAdminHealth,
  );
}