'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { withAction, ActionError } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import {
	registrarMovimiento,
	revertirMovimientosDeOrigen,
} from '@/features/inventario/movimientos';
import {
	createAjusteSchema,
	tipoUbicacionSchema,
	type CreateAjusteInput,
} from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Crea un ajuste unificado de inventario: calcula diferencia
 * contra el stock teórico de la ubicación, aplica el delta a
 * `StockUbicacion` y registra el movimiento valorizado en el kardex.
 * Rechaza si existe un conteo físico activo sobre la misma ubicación.
 * @param {CreateAjusteInput} input - Datos del ajuste validados por Zod.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Ajuste aplicado.
 */
export const createAjusteAction = withAction(
	async (input: CreateAjusteInput, user: AuthenticatedUser) => {
		const parsed = createAjusteSchema.parse(input);
		const tenantId = requireTenant(user);
		requireFeature(user, 'ajustes-inventario', 'ajustes de inventario');

		const producto = await prisma.producto.findFirst({
			where: { id: parsed.productoId, tenantId },
			select: { id: true, precioCosto: true },
		});
		if (!producto) throw new ActionError('Producto no encontrado', 'NOT_FOUND');

		const conteoActivo = await prisma.conteoInventario.findFirst({
			where: {
				tenantId,
				tipoUbicacion: parsed.tipoUbicacion,
				ubicacionId: parsed.ubicacionId,
				estado: { in: ['BORRADOR', 'CONTEO_1', 'CONTEO_2'] },
			},
			select: { id: true },
		});
		if (conteoActivo) {
			throw new ActionError(
				'Hay un conteo físico activo en esta ubicación. Conciliable o cancélalo antes de ajustar.',
				'CONTEO_ACTIVO',
			);
		}

		const stock = await prisma.stockUbicacion.findUnique({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: parsed.productoId,
					tipoUbicacion: parsed.tipoUbicacion,
					ubicacionId: parsed.ubicacionId,
				},
			},
			select: { cantidad: true },
		});
		const cantidadTeorica = stock?.cantidad ?? 0;
		const diferencia = parsed.cantidadContada - cantidadTeorica;
		if (diferencia === 0) {
			throw new ActionError(
				'La cantidad contada coincide con el stock teórico; no hay diferencia que ajustar.',
				'SIN_DIFERENCIA',
			);
		}

		const costoUnitario = producto.precioCosto; // CPP vigente en este sistema.

		const ajuste = await prisma.$transaction(async (tx: any) => {
			const creado = await tx.ajusteInventario.create({
				data: {
					tenantId,
					productoId: parsed.productoId,
					tipoUbicacion: parsed.tipoUbicacion,
					ubicacionId: parsed.ubicacionId,
					motivo: parsed.motivo,
					cantidadTeorica,
					cantidadContada: parsed.cantidadContada,
					diferencia,
					costoUnitario,
					costoTotal: diferencia * costoUnitario,
					estado: 'APLICADO',
					creadoPorId: user.userId,
				},
			});

			await upsertStockUbicacion(tx, {
				tenantId,
				productoId: parsed.productoId,
				tipoUbicacion: parsed.tipoUbicacion,
				ubicacionId: parsed.ubicacionId,
				modo: 'increment',
				delta: diferencia,
			});

			await registrarMovimiento(tx, {
				tenantId,
				productoId: parsed.productoId,
				tipoOrigen: 'AJUSTE',
				origenId: creado.id,
				tipoUbicacion: parsed.tipoUbicacion,
				ubicacionId: parsed.ubicacionId,
				cantidad: diferencia,
				costoUnitario,
				secuencia: 'AJUSTE-0',
				creadoPorId: user.userId,
			});

			return creado;
		});

		revalidatePath('/busy/inventario/ajustes');
		revalidatePath('/busy/inventario/kardex');
		return ajuste;
	},
);

/**
 * @description Anula un ajuste aplicado: revierte el stock y compensa el
 * kardex con el costo histórico de la línea original. Nunca edita el kardex.
 * @param {string} ajusteId - ID del ajuste a anular.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Resultado de la anulación.
 */
export const anularAjusteAction = withAction(
	async (ajusteId: string, user: AuthenticatedUser) => {
		if (!ajusteId) throw new ActionError('Ajuste requerido', 'VALIDATION_ERROR');
		const tenantId = requireTenant(user);
		requireFeature(user, 'ajustes-inventario', 'anular ajustes de inventario');

		const ajuste = await prisma.ajusteInventario.findFirst({
			where: { id: ajusteId, tenantId },
		});
		if (!ajuste) throw new ActionError('Ajuste no encontrado', 'NOT_FOUND');
		if (ajuste.estado !== 'APLICADO') {
			throw new ActionError(
				`El ajuste está en estado ${ajuste.estado}; solo se anulan ajustes aplicados.`,
				'AJUSTE_NO_ANULABLE',
			);
		}
		const tipoUbicacion = tipoUbicacionSchema.parse(ajuste.tipoUbicacion);

		await prisma.$transaction(async (tx: any) => {
			// Compensar kardex con el costo histórico original.
			await revertirMovimientosDeOrigen(tx, {
				tenantId,
				tipoOrigen: 'AJUSTE',
				origenId: ajuste.id,
				creadoPorId: user.userId,
			});

			await upsertStockUbicacion(tx, {
				tenantId,
				productoId: ajuste.productoId,
				tipoUbicacion,
				ubicacionId: ajuste.ubicacionId,
				modo: 'increment',
				delta: -ajuste.diferencia,
			});

			await tx.ajusteInventario.update({
				where: { id: ajuste.id },
				data: { estado: 'ANULADO' },
			});
		});

		revalidatePath('/busy/inventario/ajustes');
		return { id: ajuste.id, estado: 'ANULADO' };
	},
);

/**
 * @description Lista los ajustes del tenant con filtros básicos.
 */
export const getAjustesAction = withAction(
	async (
		input: { productoId?: string; motivo?: string; estado?: string; page?: number; limit?: number },
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const page = Math.max(1, input.page ?? 1);
		const limit = Math.min(100, Math.max(1, input.limit ?? 20));

		const where: Record<string, unknown> = { tenantId };
		if (input.productoId) where.productoId = input.productoId;
		if (input.motivo) where.motivo = input.motivo;
		if (input.estado) where.estado = input.estado;

		const [items, total] = await Promise.all([
			prisma.ajusteInventario.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip: (page - 1) * limit,
				take: limit,
			}),
			prisma.ajusteInventario.count({ where }),
		]);

		return { items, total, page, limit };
	},
);
