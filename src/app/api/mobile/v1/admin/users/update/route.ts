import { handleAdminRequest, readJsonBody } from "../../_shared";
import { updateAdminUser } from "@/features/admin/server/admin-global-queries";
import type { AdminUpdateUserInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Edita el nombre, email o rol de plataforma de un usuario desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Usuario actualizado y mensaje.
 */
export async function PATCH(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as AdminUpdateUserInput | undefined;
      return (body ?? {}) as AdminUpdateUserInput;
    },
    updateAdminUser,
  );
}
