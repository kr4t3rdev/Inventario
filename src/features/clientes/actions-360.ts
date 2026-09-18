'use server';

/**
 * @description Server Actions de CRM operativo (Gap 6): vista 360 del cliente.
 */
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import {
	requireFeature,
	requirePermission,
	requireTenant,
} from '@/lib/services/tenant-scope';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AuditLogService } from '@/lib/services/audit-log-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const notaSchema = z.object({
	texto: z.string().trim().min(2, 'La nota no puede estar vacía').max(500),
	causa: z.string().trim().max(60).optional().nullable(),
});

/**
 * @description Vista 360 del cliente: ficha, ventas recientes (con su estado y
 * devoluciones), CxC vivas y notas registradas.
 * @param {string} clienteId - ID del cliente.
 * @returns Datos consolidados del cliente.
 */
export const getCliente360Action = withAction(
	async (clienteId: string, user: AuthenticatedUser) => {
		requireFeature(user, 'clientes', 'consultar clientes');
		const tenantId = requireTenant(user);

		const cliente = await prisma.cliente.findFirst({
			where: { clienteId, tenantId },
			include: {
				Venta: {
					where: { deletedAt: null },
					orderBy: { createdAt: 'desc' },
					take: 12,
					include: {
						devoluciones: {
							select: { estado: true, total: true },
						},
					},
				},
				cuentasPorCobrar: {
					where: { estado: { not: 'ANULADA' } },
					orderBy: { createdAt: 'desc' },
				},
				anticipos: { orderBy: { createdAt: 'desc' }, take: 6 },
				notasContacto: { orderBy: { createdAt: 'desc' }, take: 10 },
			},
		});
		if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
		return cliente;
	},
);

/**
 * @description Registra una nota de contacto el cliente.
 * @param {object} input - clienteId, texto y causa opcional.
 */
export const addNotaClienteAction = withAction(
	async (
		input: { clienteId: string; texto: string; causa?: string | null },
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'clientes', 'registrar notas de contacto');
		const tenantId = requireTenant(user);
		const parsed = notaSchema.parse({ texto: input.texto, causa: input.causa });

		const cliente = await prisma.cliente.findFirst({
			where: { clienteId: input.clienteId, tenantId },
			select: { clienteId: true },
		});
		if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');

		const nota = await prisma.cobroNota.create({
			data: {
				tenantId,
				clienteId: input.clienteId,
				texto: parsed.texto,
				causa: parsed.causa ?? null,
				createdById: user.userId,
			},
		});
		await AuditLogService.logStrict({
			accion: 'EXECUTE',
			entidad: 'CUENTA_POR_COBRAR',
			entidadId: nota.id,
			usuarioId: user.userId,
			detalles: {
				tipo: 'NOTA_CLIENTE',
				clienteId: input.clienteId,
			},
		});
		revalidatePath('/busy/cliente');
		return { id: nota.id };
	},
);
