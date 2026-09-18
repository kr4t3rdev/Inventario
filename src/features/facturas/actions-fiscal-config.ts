'use server';

/**
 * @description Server Actions de configuración fiscal del tenant (Gap 4).
 */
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import {
	requireFeature,
	requirePermission,
	requireTenant,
} from '@/lib/services/tenant-scope';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const fiscalConfigSchema = z.object({
	taxId: z.string().trim().max(64).optional().nullable(),
	razonSocial: z.string().trim().max(200).optional().nullable(),
	regimenFiscal: z.string().trim().max(64).optional().nullable(),
	codigoPostalFiscal: z.string().trim().max(16).optional().nullable(),
	fiscalActivado: z.boolean().optional().default(false),
});

type FiscalConfigInput = z.infer<typeof fiscalConfigSchema>;

/**
 * @description Datos fiscales del emisor del tenant activo.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Configuración fiscal actual.
 */
export const getFiscalConfigAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		requireFeature(user, 'facturacion-fiscal', 'consultar la configuración fiscal');
		const tenantId = requireTenant(user);

		const tenant = await prisma.tenant.findFirst({
			where: { tenantId },
			select: {
				taxId: true,
				razonSocial: true,
				regimenFiscal: true,
				codigoPostalFiscal: true,
				fiscalActivado: true,
			},
		});
		return tenant;
	},
);

/**
 * @description Guarda la configuración fiscal del tenant. Permiso sensitive.
 * @param {FiscalConfigInput} input - Campos fiscales a guardar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 */
export const saveFiscalConfigAction = withAction(
	async (input: FiscalConfigInput, user: AuthenticatedUser) => {
		requireFeature(user, 'facturacion-fiscal', 'configurar la facturación fiscal');
		requirePermission(user, 'config.fiscal.gestionar', 'editar la configuración fiscal');
		const tenantId = requireTenant(user);
		const parsed = fiscalConfigSchema.parse(input);

		await prisma.tenant.update({
			where: { tenantId },
			data: {
				taxId: parsed.taxId ?? null,
				razonSocial: parsed.razonSocial ?? null,
				regimenFiscal: parsed.regimenFiscal ?? null,
				codigoPostalFiscal: parsed.codigoPostalFiscal ?? null,
				fiscalActivado: parsed.fiscalActivado,
			},
		});
		revalidatePath('/busy/configuracion/fiscal');
		return { ok: true };
	},
);
