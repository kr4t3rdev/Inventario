import { handleAdminRequest, readJsonBody } from "../../_shared";
import { approveAdminMembership } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Aprueba una membresía pendiente y activa al usuario desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Resultado de la aprobación.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as {
        membershipId?: string;
        tenantRole?: string;
      };
      return {
        membershipId: body?.membershipId ?? "",
        tenantRole: body?.tenantRole ?? "",
      };
    },
    approveAdminMembership,
  );
}