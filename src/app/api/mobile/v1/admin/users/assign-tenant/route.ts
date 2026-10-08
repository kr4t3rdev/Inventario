import { handleAdminRequest, readJsonBody } from "../../_shared";
import { assignAdminUserTenant } from "@/features/admin/server/admin-global-queries";
import type { AdminAssignTenantInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Asigna un usuario a una empresa o lo cambia de empresa desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer y cuerpo JSON.
 * @returns {Promise<Response>} Membresía resultante y mensaje.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as AdminAssignTenantInput | undefined;
      return (body ?? {}) as AdminAssignTenantInput;
    },
    assignAdminUserTenant,
  );
}
