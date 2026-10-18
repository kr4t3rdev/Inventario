import { handleAdminRequest, readJsonBody } from "../../_shared";
import { changeAdminUserTenantRole } from "@/features/admin/server/admin-global-queries";
import type { AdminChangeTenantRoleInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Cambia el rol de un usuario dentro de una empresa desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Membresía actualizada y mensaje.
 */
export async function PATCH(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as
        | AdminChangeTenantRoleInput
        | undefined;
      return (body ?? {}) as AdminChangeTenantRoleInput;
    },
    changeAdminUserTenantRole,
  );
}
