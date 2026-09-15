'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { withAction, ActionError } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento } from '@/features/inventario/movimientos';
import {
	conciliarConteoSchema,
	iniciarConteoSchema,
	registrarConteoSchema,
	tipoUbicacionSchema,
	type ConciliarConteoInput,
	type IniciarConteoInput,
	type RegistrarConteoInput,
} from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Inicia un conteo físico en una ubicación: crea el documento
 * en estado BORRADOR con una línea por cada producto con stock teórico allí.
 * @param {IniciarConteoInput} input - Ubicación a contar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Conteo creado.
 */
export const iniciarConteoAction = withAction(
	async (input: IniciarConteoInput, user: AuthenticatedUser) => {
		const parsed = iniciarConteoSchema.parse(input);
		const tenantId = requireTenant(user);
		requireFeature(user, 'conteo-fisico', 'iniciar conteos físicos');

		const activo = await prisma.conteoInventario.findFirst({
			where: {
				tenantId,
				tipoUbicacion: parsed.tipoUbicacion,
				ubicacionId: parsed.ubicacionId,
				estado: { in: ['BORRADOR', 'CONTEO_1', 'CONTEO_2'] },
			},
			select: { id: true },
		});
		if (activo) {
			throw new ActionError(
				'Ya existe un conteo activo en esta ubicación.',
				'CONTEO_ACTIVO',
			);
		}

		return prisma.$transaction(async (tx: any) => {
			const conteo = await tx.conteoInventario.create({
				data: {
					tenantId,
					tipoUbicacion: parsed.tipoUbicacion,
					ubicacionId: parsed.ubicacionId,
					observaciones: parsed.observaciones ?? null,
					estado: 'BORRADOR',
					iniciadoPorId: user.userId,
				},
			});

			const stock = await tx.stockUbicacion.findMany({
				where: {
					tenantId,
					tipoUbicacion: parsed.tipoUbicacion,
					ubicacionId: parsed.ubicacionId,
				},
				select: { productoId: true, cantidad: true },
			});

			if (stock.length > 0) {
				await tx.conteoLinea.createMany({
					data: stock.map((s: any) => ({
						conteoId: conteo.id,
						tenantId,
						productoId: s.productoId,
						teorico: s.cantidad,
					})),
				});
			}

			return conteo;
		});
	},
);

/**
 * @description Registra la primera o segunda captura ciega del conteo.
 * La segunda captura exige un usuario distinto al de la primera.
 * @param {RegistrarConteoInput} input - Líneas capturadas sin ver el teórico.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Conteo actualizado.
 */
export const registrarConteoAction = withAction(
	async (input: RegistrarConteoInput, user: AuthenticatedUser) => {
		const parsed = registrarConteoSchema.parse(input);
		const tenantId = requireTenant(user);
		requireFeature(user, 'conteo-fisico', 'registrar capturas de conteo');

		const conteo = await prisma.conteoInventario.findFirst({
			where: { id: parsed.conteoId, tenantId },
		});
		if (!conteo) throw new ActionError('Conteo no encontrado', 'NOT_FOUND');
		if (!['BORRADOR', 'CONTEO_1'].includes(conteo.estado)) {
			throw new ActionError(
				`El conteo está en estado ${conteo.estado} y no acepta capturas.`,
				'ESTADO_INVALIDO',
			);
		}

		const esSegundaCaptura = conteo.estado === 'CONTEO_1';

		return prisma.$transaction(async (tx: any) => {
			if (esSegundaCaptura) {
				const previas = await tx.conteoLinea.findMany({
					where: { conteoId: conteo.id },
					select: { productoId: true, usuario1Id: true },
				});
				const idsPrimerUsuario = new Set(
					previas.map((l: any) => l.usuario1Id).filter(Boolean),
				);
				for (const linea of parsed.lineas) {
					if (idsPrimerUsuario.has(user.userId)) {
						throw new ActionError(
							'La segunda captura debe registrarla una persona distinta a la primera.',
							'MISMO_CONTADOR',
						);
					}
					void linea;
				}
			}

			for (const linea of parsed.lineas) {
				await tx.conteoLinea.updateMany({
					where: { conteoId: conteo.id, productoId: linea.productoId },
					data: esSegundaCaptura
						? { conteo2: linea.cantidad, usuario2Id: user.userId }
						: { conteo1: linea.cantidad, usuario1Id: user.userId },
				});
			}

			return tx.conteoInventario.update({
				where: { id: conteo.id },
				data: { estado: esSegundaCaptura ? 'CONTEO_2' : 'CONTEO_1' },
			});
		});
	},
);

/**
 * @description Concilia un conteo en CONTEO_2: para cada línea resuelve el
 * valor final (de `finales`, o el valor coincidente de ambas capturas) y
 * genera un ajuste + movimiento de kardex por cada varianza.
 * @param {ConciliarConteoInput} input - Valores finales por producto.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Resumen de varianzas y estado final.
 */
export const conciliarConteoAction = withAction(
	async (input: ConciliarConteoInput, user: AuthenticatedUser) => {
		const parsed = conciliarConteoSchema.parse(input);
		const tenantId = requireTenant(user);
		requireFeature(user, 'conteo-fisico', 'conciliar conteos físicos');

		const conteo = await prisma.conteoInventario.findFirst({
			where: { id: parsed.conteoId, tenantId },
		});
		if (!conteo) throw new ActionError('Conteo no encontrado', 'NOT_FOUND');
		if (conteo.estado !== 'CONTEO_2') {
			throw new ActionError(
				`El conteo está en estado ${conteo.estado}; se concilia solo en CONTEO_2.`,
				'ESTADO_INVALIDO',
			);
		}
		const tipoUbicacion = tipoUbicacionSchema.parse(conteo.tipoUbicacion);

		return prisma.$transaction(async (tx: any) => {
			const lineas = await tx.conteoLinea.findMany({
				where: { conteoId: conteo.id },
			});

			const finalesPorProducto = new Map(
				parsed.finales.map((f) => [f.productoId, f.contadoFinal]),
			);

			for (const linea of lineas) {
				let fin = finalesPorProducto.get(linea.productoId);
				if (fin === undefined) {
					if (linea.conteo1 !== null && linea.conteo1 === linea.conteo2) {
						fin = linea.conteo1;
					} else {
						throw new ActionError(
							`El producto ${linea.productoId} tiene capturas distintas y requiere un valor final reconciliado.`,
							'VARIANZA_SIN_RESOLVER',
						);
					}
				}
				await tx.conteoLinea.update({
					where: { id: linea.id },
					data: { contadoFinal: fin },
				});
			}

			let ajustes = 0;
			for (const linea of lineas) {
				const fin = finalesPorProducto.get(linea.productoId) ??
					linea.conteo1!; // ya validado arriba
				const diferencia = fin - linea.teorico;
				if (diferencia === 0) continue;

				const producto = await tx.producto.findUnique({
					where: { id: linea.productoId },
					select: { precioCosto: true },
				});
				const costoUnitario = producto?.precioCosto ?? 0;

				const ajuste = await tx.ajusteInventario.create({
					data: {
						tenantId,
						productoId: linea.productoId,
						tipoUbicacion,
						ubicacionId: conteo.ubicacionId,
						motivo: 'ERROR_CONTEO',
						cantidadTeorica: linea.teorico,
						cantidadContada: fin,
						diferencia,
						costoUnitario,
						costoTotal: diferencia * costoUnitario,
						estado: 'APLICADO',
						origenConteoId: conteo.id,
						creadoPorId: user.userId,
					},
				});

				await tx.conteoLinea.update({
					where: { id: linea.id },
					data: { ajusteId: ajuste.id },
				});

				await upsertStockUbicacion(tx, {
					tenantId,
					productoId: linea.productoId,
					tipoUbicacion,
					ubicacionId: conteo.ubicacionId,
					modo: 'increment',
					delta: diferencia,
				});

				await registrarMovimiento(tx, {
					tenantId,
					productoId: linea.productoId,
					tipoOrigen: 'CONTEO',
					origenId: conteo.id,
					tipoUbicacion,
					ubicacionId: conteo.ubicacionId,
					cantidad: diferencia,
					costoUnitario,
					secuencia: `CONTEO-${linea.id}`,
					creadoPorId: user.userId,
				});

				ajustes++;
			}

			await tx.conteoInventario.update({
				where: { id: conteo.id },
				data: {
					estado: 'AJUSTADO',
					conciliadoPorId: user.userId,
					conciliadoAt: new Date(),
				},
			});

			return { ajustes, estado: 'AJUSTADO' };
		});
	},
);

const cancelarConteoSchema = z.object({ conteoId: z.string().min(1) });

/**
 * @description Lista conteos del tenant (orden más reciente primero).
 * @param {{ estado?: string; limit?: number }} input - Filtros básicos.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Conteos con tenantId del contexto.
 */
export const getConteosAction = withAction(
	async (input: { estado?: string; limit?: number }, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		const where: Record<string, unknown> = { tenantId };
		if (input?.estado) where.estado = input.estado;
		return prisma.conteoInventario.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			take: Math.min(200, input?.limit ?? 50),
		});
	},
);

/**
 * @description Cancela un conteo que aún no genera ajustes.
 * @param {{ conteoId: string }} input - Conteo a cancelar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Conteo cancelado.
 */
export const cancelarConteoAction = withAction(
	async (input: { conteoId: string }, user: AuthenticatedUser) => {
		const parsed = cancelarConteoSchema.parse(input);
		const tenantId = requireTenant(user);
		requireFeature(user, 'conteo-fisico', 'cancelar conteos físicos');

		const conteo = await prisma.conteoInventario.findFirst({
			where: { id: parsed.conteoId, tenantId },
		});
		if (!conteo) throw new ActionError('Conteo no encontrado', 'NOT_FOUND');
		if (!['BORRADOR', 'CONTEO_1', 'CONTEO_2'].includes(conteo.estado)) {
			throw new ActionError(
				`El conteo ya fue ${conteo.estado}; no se puede cancelar.`,
				'ESTADO_INVALIDO',
			);
		}

		await prisma.conteoInventario.update({
			where: { id: conteo.id },
			data: { estado: 'CANCELADO' },
		});

		revalidatePath('/busy/inventario/conteos');
		return { id: conteo.id, estado: 'CANCELADO' };
	},
);
