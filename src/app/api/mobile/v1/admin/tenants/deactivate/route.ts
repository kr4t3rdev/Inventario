import { handleAdminRequest, readJsonBody } from "../../_shared";
import { deactivateAdminTenant } from "@/features/admin/server/admin-global-queries";
import type { AdminTenantIdInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Desactiva una empresa bloqueando a sus miembros desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Cantidad desactivada y mensaje.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as AdminTenantIdInput | undefined;
      return { tenantId: body?.tenantId ?? "" };
    },
    deactivateAdminTenant,
  );
}
