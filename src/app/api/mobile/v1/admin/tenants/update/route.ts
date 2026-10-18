import { handleAdminRequest, readJsonBody } from "../../_shared";
import { updateAdminTenant } from "@/features/admin/server/admin-global-queries";
import type { AdminUpdateTenantInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Edita el nombre, datos y configuración de una empresa desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Empresa actualizada y mensaje.
 */
export async function PATCH(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as AdminUpdateTenantInput | undefined;
      return (body ?? {}) as AdminUpdateTenantInput;
    },
    updateAdminTenant,
  );
}
