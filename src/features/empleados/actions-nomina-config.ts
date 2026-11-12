/**
 * @description Server Actions F-5: configuración de nómina por tenant
 * (NominaConfig, 1:1 con patrón TenantAccountingPolicy).
 *
 * @module features/empleados/actions-nomina-config
 */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAction } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import {
	requireFeature,
	requireTenant,
	requirePermission,
} from "@/lib/services/tenant-scope";
import {
	OVERTIME_RATE_MULTIPLIER,
	STANDARD_MONTHLY_HOURS,
} from "@/lib/payroll-formulas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

/** Defaults vigentes cuando el tenant no tiene config guardada. */
export const NOMINA_CONFIG_DEFAULTS = {
	tarifaHoraExtra: OVERTIME_RATE_MULTIPLIER,
	horasMensualesEstandar: STANDARD_MONTHLY_HOURS,
	monedaPago: "CUP",
} as const;

const nominaConfigSchema = z.object({
	// Multiplicador de la hora extra sobre la tarifa horaria (1.5 legal).
	tarifaHoraExtra: z.number().positive().max(10),
	// Horas estándar del mes que definen la tarifa horaria (192 legal).
	horasMensualesEstandar: z.number().int().min(20).max(300),
	// Código ISO 4217 de la moneda de pago.
	monedaPago: z
		.string()
		.regex(/^[A-Z]{3}$/, "Debe ser un código de moneda de 3 letras")
		.default("CUP"),
});

export type NominaConfigInput = z.infer<typeof nominaConfigSchema>;

/**
 * @description Devuelve la NominaConfig del tenant (o null si nunca se guardó)
 * junto a los defaults vigentes, para que la UI siempre pueda mostrar ambos.
 */
export const getNominaConfigAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		requireFeature(user, "nomina", "gestionar nómina");
		const tenantId = requireTenant(user);
		const config = await prisma.nominaConfig.findUnique({
			where: { tenantId },
		});
		return { config, defaults: NOMINA_CONFIG_DEFAULTS };
	},
);

/**
 * @description Crea o actualiza la NominaConfig del tenant con auditoría de
 * quién guardó el cambio (`updatedBy`).
 */
export const upsertNominaConfigAction = withAction(
	async (input: NominaConfigInput, user: AuthenticatedUser) => {
		requireFeature(user, "nomina", "gestionar nómina");
		requirePermission(user, "rrhh.nomina.configurar", "configurar la nómina");
		const parsed = nominaConfigSchema.parse(input);
		const tenantId = requireTenant(user);
		const config = await prisma.nominaConfig.upsert({
			where: { tenantId },
			create: { ...parsed, tenantId, updatedBy: user.userId },
			update: { ...parsed, updatedBy: user.userId },
		});
		revalidatePath("/busy/empleados/nomina");
		return config;
	},
);
