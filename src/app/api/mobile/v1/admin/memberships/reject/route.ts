import { handleAdminRequest, readJsonBody } from "../../_shared";
import { rejectAdminMembership } from "@/features/admin/server/admin-global-queries";

export const dynamic = "force-dynamic";

/**
 * @description Rechaza una membresía pendiente y restablece el onboarding del usuario desde el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Resultado del rechazo.
 */
export async function POST(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const body = (await readJsonBody(req)) as { membershipId?: string };
      return { membershipId: body?.membershipId ?? "" };
    },
    rejectAdminMembership,
  );
}