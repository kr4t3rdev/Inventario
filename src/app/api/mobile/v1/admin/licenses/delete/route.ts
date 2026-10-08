import { handleAdminRequest, readJsonBody } from "../../_shared";
import { deleteAdminLicense } from "@/features/admin/server/admin-global-queries";
import type { AdminLicenciaIdInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Elimina permanentemente una licencia desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Confirmación de eliminación.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as AdminLicenciaIdInput | undefined;
      return { tenantLicenseId: body?.tenantLicenseId ?? "" };
    },
    deleteAdminLicense,
  );
}
