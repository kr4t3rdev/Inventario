import { handleAdminRequest, readJsonBody } from "../../_shared";
import { lockAdminUser } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Bloquea un usuario por 24 horas desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Usuario actualizado y mensaje.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as { userId?: string };
      return { userId: body?.userId ?? "" };
    },
    lockAdminUser,
  );
}