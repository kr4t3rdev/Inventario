import { handleAdminRequest } from "../../_shared";
import { getAdminLicenseStats } from "@/features/admin/server/admin-global-queries";
import { licenciasStatsQuerySchema } from "@/features/admin/schemas";
import type { LicenciasStatsQueryInput } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

/**
 * @description Métricas agregadas de licencias para el panel admin mobile.
 * @param {Request} request - Request autenticado con Bearer.
 * @returns {Promise<Response>} Métricas de licencias.
 */
export async function GET(request: Request) {
  return handleAdminRequest(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      return licenciasStatsQuerySchema.parse(
        Object.fromEntries(searchParams),
      ) as LicenciasStatsQueryInput;
    },
    getAdminLicenseStats,
  );
}