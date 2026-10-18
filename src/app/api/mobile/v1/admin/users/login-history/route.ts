import { handleAdminRequest } from "../../_shared";
import { getAdminUserLoginHistory } from "@/features/admin/server/admin-global-queries";
import type { AdminLoginHistoryQueryInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Obtiene el historial de sesiones de un usuario para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer (?userId=&limit=).
 * @returns {Promise<Response>} Sesiones del usuario ordenadas por fecha descendente.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      const input: AdminLoginHistoryQueryInput = {
        userId: searchParams.get("userId") ?? "",
      };
      const limit = searchParams.get("limit");
      if (limit) input.limit = Number(limit);
      return input;
    },
    getAdminUserLoginHistory,
  );
}
