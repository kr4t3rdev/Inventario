import { handleAdminRequest, readJsonBody } from "../../_shared";
import { removeAdminTenantUser } from "@/features/admin/server/admin-global-queries";
import type { AdminRemoveTenantUserInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Quita un usuario de una empresa desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Resultado y mensaje.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as
        | AdminRemoveTenantUserInput
        | undefined;
      return (body ?? {}) as AdminRemoveTenantUserInput;
    },
    removeAdminTenantUser,
  );
}
