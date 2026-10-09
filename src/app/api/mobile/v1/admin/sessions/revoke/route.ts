import { handleAdminRequest, readJsonBody } from "../../_shared";
import { revokeAdminSession } from "@/features/admin/server/admin-global-queries";
import type { AdminRevokeSessionInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Revoca una sesión específica desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Confirmación de revocación.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as AdminRevokeSessionInput | undefined;
      return { sessionId: body?.sessionId ?? "" };
    },
    revokeAdminSession,
  );
}
