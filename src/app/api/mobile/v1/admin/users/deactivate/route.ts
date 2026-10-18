import { handleAdminRequest, readJsonBody } from "../../_shared";
import { deactivateAdminUser } from "@/features/admin/server/admin-global-queries";
import type { AdminUserIdInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Desactiva un usuario y revoca sus sesiones desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Estado actualizado y mensaje.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as AdminUserIdInput | undefined;
      return { userId: body?.userId ?? "" };
    },
    deactivateAdminUser,
  );
}
