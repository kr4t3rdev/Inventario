/**
 * @description Server Actions para licencias con paginación, sorting y filtros.
 */
"use server";

import { withAction, ActionError } from "@/lib/server-actions";
import { getLicenciasQuerySchema, licenciasStatsQuerySchema } from "./schemas";
import type { GetLicenciasQueryInput, LicenciasStatsQueryInput } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { getAdminLicenses, getAdminLicenseStats } from "./server/admin-global-queries";

export const getLicenciasPaginatedAction = withAction(getAdminLicenses);

/**
 * @description Obtiene métricas agregadas de licencias respetando los mismos filtros
 * que la tabla paginada. Devuelve total, activas, expiradas, demos,
 * adminTest y porVencer (7 días).
 */
export const getLicenciasStatsAction = withAction(getAdminLicenseStats);
