import { handleAdminRequest } from "../_shared";
import { getAdminActivityLogs } from "@/features/admin/server/admin-global-queries";
import type { AdminActivityLogsQueryInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Obtiene el registro de actividad de los usuarios para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer (?userId=&limit=).
 * @returns {Promise<Response>} Entradas del log ordenadas por fecha descendente.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      const input: AdminActivityLogsQueryInput = {};
      const userId = searchParams.get("userId");
      const limit = searchParams.get("limit");
      if (userId) input.userId = userId;
      if (limit) input.limit = Number(limit);
      return input;
    },
    getAdminActivityLogs,
  );
}
