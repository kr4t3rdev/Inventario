import { handleAdminRequest, readJsonBody } from "../../../_shared";
import { assignAdminTenantLicense } from "@/features/admin/server/admin-global-queries";
import type { AdminAssignTenantLicenseInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Asigna una licencia nueva a una empresa desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Licencia creada y mensaje.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as
        | AdminAssignTenantLicenseInput
        | undefined;
      return (body ?? {}) as AdminAssignTenantLicenseInput;
    },
    assignAdminTenantLicense,
  );
}
