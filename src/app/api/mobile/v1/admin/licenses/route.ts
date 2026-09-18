import { handleAdminRequest } from "../_shared";
import { getAdminLicenses } from "@/features/admin/server/admin-global-queries";
import { getLicenciasQuerySchema } from "@/features/admin/schemas";
import type { GetLicenciasQueryInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Lista licencias paginadas con filtros para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Licencias paginadas y total.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      return getLicenciasQuerySchema.parse(
        Object.fromEntries(searchParams),
      ) as GetLicenciasQueryInput;
    },
    getAdminLicenses,
  );
}