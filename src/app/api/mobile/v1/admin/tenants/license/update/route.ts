import { handleAdminRequest, readJsonBody } from "../../../_shared";
import { updateAdminTenantLicense } from "@/features/admin/server/admin-global-queries";
import type { AdminUpdateTenantLicenseInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Modifica el plan, los límites o el vencimiento de una licencia desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Licencia actualizada y mensaje.
 */
export async function PATCH(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as
        | AdminUpdateTenantLicenseInput
        | undefined;
      return (body ?? {}) as AdminUpdateTenantLicenseInput;
    },
    updateAdminTenantLicense,
  );
}
