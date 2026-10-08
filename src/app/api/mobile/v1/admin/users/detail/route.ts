import { handleAdminRequest } from "../../_shared";
import { getAdminUserDetail } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Obtiene la ficha individual de un usuario para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer (?userId=).
 * @returns {Promise<Response>} Detalle del usuario con membresías y sesiones activas.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      return { userId: searchParams.get("userId") ?? "" };
    },
    getAdminUserDetail,
  );
}
