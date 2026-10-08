import { handleAdminRequest, readJsonBody } from "../../_shared";
import { verifyAdminUserEmail } from "@/features/admin/server/admin-global-queries";
import type { AdminUserIdInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Marca manualmente el email de un usuario como verificado desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Estado de verificación y mensaje.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as AdminUserIdInput | undefined;
      return { userId: body?.userId ?? "" };
    },
    verifyAdminUserEmail,
  );
}
