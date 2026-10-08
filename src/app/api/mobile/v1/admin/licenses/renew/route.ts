import { handleAdminRequest, readJsonBody } from "../../_shared";
import { renewAdminLicense } from "@/features/admin/server/admin-global-queries";
import type { AdminRenewLicenciaInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Renueva una licencia extendiendo su expiración desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Resultado de la renovación y mensaje.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as
        | AdminRenewLicenciaInput
        | undefined;
      return (body ?? {}) as AdminRenewLicenciaInput;
    },
    renewAdminLicense,
  );
}
