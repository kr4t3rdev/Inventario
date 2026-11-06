'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { registrarMovimiento, revertirMovimientosDeOrigen } from '@/features/inventario/movimientos';
import { ActionError, withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { getStockTotalProducto } from '@/lib/services/stock-ubicacion-queries';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { Prisma } from '@/generated/prisma';

const IMPUTACIONES = ['IMPUTACION_CXP', 'SALDO_FAVOR'] as const;

const crearSchema = z.object({
	compraDocumentoId: z.string().min(1),
	formaImputacion: z.enum(IMPUTACIONES),
	motivo: z.string().max(500).optional().nullable(),
	idempotencyKey: z.string().min(8).max(128).optional(),
	items: z.array(z.object({
		compraDocumentoItemId: z.string().min(1),
		cantidad: z.coerce.number().int().positive(),
	})).min(1),
});

type CrearInput = z.input<typeof crearSchema>;

/**
 * @description Genera un consecutivo anual por tenant. El tenant se bloquea antes
 * de invocar esta función para que dos devoluciones no obtengan el mismo número.
 * @param {Prisma.TransactionClient} tx - Transacción activa.
 * @param {string} tenantId - Tenant propietario.
 * @returns {Promise<string>} Número de devolución único dentro del tenant.
 */
async function generarNumero(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await tx.devolucionCompra.count({
		where: {
			tenantId,
			createdAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
		},
	});
	return `DV-${year}-${String(count + 1).padStart(6, '0')}`;
}

/**
 * @description Crea una devolución pendiente y reserva cantidades elegibles de
 * líneas de compra, sin modificar todavía stock ni cuentas por pagar.
 * @param {CrearInput} input - Compra origen, imputación e ítems devueltos.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Devolución creada o existente por idempotencia.
 */
export const crearDevolucionCompraAction = withAction(
	async (input: CrearInput, user: AuthenticatedUser) => {
		const parsed = crearSchema.parse(input);
		const tenantId = requireTenant(user);
		requirePermission(user, 'compras.compras.gestionar', 'registrar devoluciones a proveedores');

		const result = await prisma.$transaction(async (tx) => {
			// Serializa numeración y reservas de devolución para este tenant.
			await tx.$queryRaw`SELECT "tenantId" FROM "tenants" WHERE "tenantId" = ${tenantId} FOR UPDATE`;

			if (parsed.idempotencyKey) {
				const existing = await tx.devolucionCompra.findFirst({
					where: { tenantId, idempotencyKey: parsed.idempotencyKey },
				});
				if (existing) return existing;
			}

			const compra = await tx.compraDocumento.findFirst({
				where: { tenantId, compraDocumentoId: parsed.compraDocumentoId, deletedAt: null },
				include: { items: true },
			});
			if (!compra) throw new ActionError('Compra no encontrada', 'NOT_FOUND');
			if (compra.estado === 'ANULADA') {
				throw new ActionError('No se puede devolver una compra anulada', 'COMPRA_ANULADA');
			}

			const seleccion = new Map<string, number>();
			for (const item of parsed.items) {
				seleccion.set(
					item.compraDocumentoItemId,
					(seleccion.get(item.compraDocumentoItemId) ?? 0) + item.cantidad,
				);
			}

			const lineas: Array<{
				tenantId: string;
				compraDocumentoItemId: string;
				productoId: string;
				cantidad: number;
				costoUnitario: number;
				total: number;
			}> = [];
			let montoTotal = 0;

			for (const [compraDocumentoItemId, cantidad] of seleccion) {
				const compraItem = compra.items.find(
					(item) => item.compraDocumentoItemId === compraDocumentoItemId,
				);
				if (!compraItem) {
					throw new ActionError('La línea no pertenece a la compra indicada', 'NOT_FOUND');
				}

				const [asignaciones, devolucionesPrevias] = await Promise.all([
					tx.purchaseAllocation.aggregate({
						where: { tenantId, compraDocumentoItemId },
						_sum: { cantidad: true },
					}),
					tx.devolucionCompraItem.aggregate({
						where: {
							tenantId,
							compraDocumentoItemId,
							devolucion: { tenantId, estado: { not: 'ANULADA' } },
						},
						_sum: { cantidad: true },
					}),
				]);
				const asignada = asignaciones._sum.cantidad ?? 0;
				const yaDevuelta = devolucionesPrevias._sum.cantidad ?? 0;
				const disponible = compraItem.cantidad - asignada - yaDevuelta;
				if (cantidad > disponible) {
					throw new ActionError(
						`La cantidad supera lo disponible para devolver (${Math.max(disponible, 0)}).`,
						'STOCK_DEVUELTO_ASIGNADO',
					);
				}

				const total = cantidad * compraItem.precioUnitario;
				if (!Number.isSafeInteger(total)) {
					throw new ActionError('El total de la devolución excede el límite permitido', 'VALIDATION_ERROR');
				}
				lineas.push({
					tenantId,
					compraDocumentoItemId,
					productoId: compraItem.productoId,
					cantidad,
					costoUnitario: compraItem.precioUnitario,
					total,
				});
				montoTotal += total;
			}

			return tx.devolucionCompra.create({
				data: {
					tenantId,
					numero: await generarNumero(tx, tenantId),
					compraDocumentoId: compra.compraDocumentoId,
					proveedorId: compra.proveedorId,
					estado: 'PENDIENTE',
					formaImputacion: parsed.formaImputacion,
					motivo: parsed.motivo || null,
					montoTotal,
					idempotencyKey: parsed.idempotencyKey,
					creadoPorId: user.userId,
					moneda: compra.moneda,
					items: { create: lineas },
				},
				include: { items: true },
			});
		});

		revalidatePath('/busy/compras-productos');
		return result;
	},
);

/**
 * @description Completa una devolución pendiente: descuenta stock y kardex,
 * reduciendo la deuda operativa o registrando saldo a favor.
 * @param {string} devolucionId - Identificador de la devolución.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Devolución completada o ya completada.
 */
export const completarDevolucionCompraAction = withAction(
	async (devolucionId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requirePermission(user, 'compras.compras.gestionar', 'completar devoluciones a proveedores');

		const result = await prisma.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT "devolucionId" FROM "devoluciones_compra" WHERE "tenantId" = ${tenantId} AND "devolucionId" = ${devolucionId} FOR UPDATE`;
			const devolucion = await tx.devolucionCompra.findFirst({
				where: { tenantId, devolucionId },
				include: { items: true, compraDocumento: { include: { cuentaPorPagar: true } } },
			});
			if (!devolucion) throw new ActionError('Devolución no encontrada', 'NOT_FOUND');
			if (devolucion.estado === 'COMPLETADA') return devolucion;
			if (devolucion.estado !== 'PENDIENTE') {
				throw new ActionError('No se puede completar una devolución anulada', 'ESTADO_INVALIDO');
			}

			let montoImputado = 0;
			let montoImputadoFuncional: number | null = null;
			let saldoAFavor = devolucion.montoTotal;
			let cxpId: string | null = null;
			let cxp: {
				montoDeuda: Prisma.Decimal;
				montoPagado: Prisma.Decimal;
				saldoPendiente: Prisma.Decimal;
				montoDeudaFuncional: Prisma.Decimal | null;
			} | null = null;
			if (devolucion.formaImputacion === 'IMPUTACION_CXP') {
				cxpId = devolucion.compraDocumento?.cuentaPorPagar?.cuentaPorPagarId ?? null;
				if (!cxpId) {
					throw new ActionError(
						'La compra no tiene una cuenta por pagar para imputar; selecciona saldo a favor.',
						'SIN_CXP_PARA_IMPUTAR',
					);
				}
				await tx.$queryRaw`SELECT "cuentaPorPagarId" FROM "CuentaPorPagar" WHERE "tenantId" = ${tenantId} AND "cuentaPorPagarId" = ${cxpId} FOR UPDATE`;
				cxp = await tx.cuentaPorPagar.findFirst({ where: { tenantId, cuentaPorPagarId: cxpId } });
				if (!cxp) throw new ActionError('Cuenta por pagar no encontrada', 'NOT_FOUND');
				const deuda = Number(cxp.montoDeuda);
				const pagado = Number(cxp.montoPagado);
				const saldo = Math.max(0, Math.min(Number(cxp.saldoPendiente), deuda - pagado));
				montoImputado = Math.min(devolucion.montoTotal, saldo);
				saldoAFavor = devolucion.montoTotal - montoImputado;
				if (cxp.montoDeudaFuncional != null && deuda > 0) {
					montoImputadoFuncional = Number(
						((montoImputado * Number(cxp.montoDeudaFuncional)) / deuda).toFixed(4),
					);
				}
			}

			for (const [index, item] of devolucion.items.entries()) {
				const [asignaciones, otrasDevoluciones] = await Promise.all([
					tx.purchaseAllocation.aggregate({
						where: { tenantId, compraDocumentoItemId: item.compraDocumentoItemId },
						_sum: { cantidad: true },
					}),
					tx.devolucionCompraItem.aggregate({
						where: {
							tenantId,
							compraDocumentoItemId: item.compraDocumentoItemId,
							devolucionId: { not: devolucionId },
							devolucion: { tenantId, estado: { not: 'ANULADA' } },
						},
						_sum: { cantidad: true },
					}),
				]);
				const asignada = asignaciones._sum.cantidad ?? 0;
				const reservadaPorOtras = otrasDevoluciones._sum.cantidad ?? 0;
				const lineaCompra = await tx.compraDocumentoItem.findFirst({
					where: { tenantId, compraDocumentoItemId: item.compraDocumentoItemId },
					select: { cantidad: true },
				});
				if (!lineaCompra || item.cantidad > lineaCompra.cantidad - asignada - reservadaPorOtras) {
					throw new ActionError(
						'La cantidad ya no está disponible para devolver porque fue asignada a ventas u otra devolución.',
						'STOCK_DEVUELTO_ASIGNADO',
					);
				}
				const producto = await tx.producto.findUnique({
					where: { id: item.productoId, tenantId },
					select: { id: true, almacenId: true },
				});
				if (!producto) throw new ActionError('Producto de la devolución no encontrado', 'NOT_FOUND');
				const stock = await getStockTotalProducto(tx, { productoId: item.productoId });
				if (stock < item.cantidad) {
					throw new ActionError('El stock disponible no alcanza para devolver la mercancía', 'STOCK_INSUFICIENTE');
				}
				await upsertStockUbicacion(tx, {
					tenantId,
					productoId: item.productoId,
					tipoUbicacion: 'almacen',
					ubicacionId: producto.almacenId,
					modo: 'increment',
					delta: -item.cantidad,
				});
				await registrarMovimiento(tx, {
					tenantId,
					productoId: item.productoId,
					tipoOrigen: 'DEVOLUCION_COMPRA',
					origenId: devolucionId,
					tipoUbicacion: 'almacen',
					ubicacionId: producto.almacenId,
					cantidad: -item.cantidad,
					costoUnitario: item.costoUnitario,
					secuencia: `ITEM-${index}`,
					creadoPorId: user.userId,
				});
			}

			if (cxpId && cxp) {
				const nuevaDeuda = Number(cxp.montoDeuda) - montoImputado;
				const nuevoSaldo = Math.max(0, Number(cxp.saldoPendiente) - montoImputado);
				const nuevaDeudaFuncional = cxp.montoDeudaFuncional == null || montoImputadoFuncional == null
					? undefined
					: Math.max(0, Number(cxp.montoDeudaFuncional) - montoImputadoFuncional);
				await tx.cuentaPorPagar.update({
					where: { cuentaPorPagarId: cxpId },
					data: {
						montoDeuda: nuevaDeuda,
						...(nuevaDeudaFuncional === undefined ? {} : { montoDeudaFuncional: nuevaDeudaFuncional }),
						saldoPendiente: nuevoSaldo,
						estado: nuevoSaldo === 0
							? 'PAGADA'
							: Number(cxp.montoPagado) === 0 ? 'PENDIENTE' : 'PARCIAL',
					},
				});
			}

			return tx.devolucionCompra.update({
				where: { devolucionId },
				data: {
					estado: 'COMPLETADA',
					montoImputado,
					montoImputadoFuncional,
					saldoAFavor,
					completadaAt: new Date(),
				},
				include: { items: true },
			});
		});

		revalidatePath('/busy/compras-productos');
		return result;
	},
);

/**
 * @description Anula una devolución. Si se completó, restaura stock y CxP y
 * emite movimientos compensatorios append-only en el kardex.
 * @param {string} devolucionId - Identificador de la devolución.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Devolución anulada o ya anulada.
 */
export const anularDevolucionCompraAction = withAction(
	async (devolucionId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requirePermission(user, 'compras.compras.gestionar', 'anular devoluciones a proveedores');

		const result = await prisma.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT "devolucionId" FROM "devoluciones_compra" WHERE "tenantId" = ${tenantId} AND "devolucionId" = ${devolucionId} FOR UPDATE`;
			const devolucion = await tx.devolucionCompra.findFirst({
				where: { tenantId, devolucionId },
				include: { items: true, compraDocumento: { include: { cuentaPorPagar: true } } },
			});
			if (!devolucion) throw new ActionError('Devolución no encontrada', 'NOT_FOUND');
			if (devolucion.estado === 'ANULADA') return devolucion;

			if (devolucion.estado === 'COMPLETADA') {
				if (devolucion.montoImputado > 0) {
					const cxpId = devolucion.compraDocumento?.cuentaPorPagar?.cuentaPorPagarId;
					if (!cxpId || !devolucion.completadaAt) {
						throw new ActionError('No se puede verificar la imputación de esta devolución', 'CXP_NO_VERIFICABLE');
					}
					await tx.$queryRaw`SELECT "cuentaPorPagarId" FROM "CuentaPorPagar" WHERE "tenantId" = ${tenantId} AND "cuentaPorPagarId" = ${cxpId} FOR UPDATE`;
					const pagoPosterior = await tx.pagoCuentaPorPagar.findFirst({
						where: { tenantId, cuentaPorPagarId: cxpId, createdAt: { gt: devolucion.completadaAt } },
						select: { pagoCuentaPorPagarId: true },
					});
					if (pagoPosterior) {
						throw new ActionError(
							'No se puede anular: la imputación ya se utilizó en un pago posterior al proveedor.',
							'DEVOLUCION_IMPUTACION_CONSUMIDA',
						);
					}
				}

				for (const item of devolucion.items) {
					const producto = await tx.producto.findUnique({
						where: { id: item.productoId, tenantId },
						select: { id: true, almacenId: true },
					});
					if (!producto) throw new ActionError('Producto de la devolución no encontrado', 'NOT_FOUND');
					await upsertStockUbicacion(tx, {
						tenantId,
						productoId: item.productoId,
						tipoUbicacion: 'almacen',
						ubicacionId: producto.almacenId,
						modo: 'increment',
						delta: item.cantidad,
					});
				}
				await revertirMovimientosDeOrigen(tx, {
					tenantId,
					tipoOrigen: 'DEVOLUCION_COMPRA',
					origenId: devolucionId,
					creadoPorId: user.userId,
				});

				if (devolucion.montoImputado > 0) {
					const cxpId = devolucion.compraDocumento?.cuentaPorPagar?.cuentaPorPagarId;
					const cxp = cxpId
						? await tx.cuentaPorPagar.findFirst({ where: { tenantId, cuentaPorPagarId: cxpId } })
						: null;
					if (!cxp || !cxpId) throw new ActionError('Cuenta por pagar no encontrada', 'NOT_FOUND');
					const nuevaDeuda = Number(cxp.montoDeuda) + devolucion.montoImputado;
					const nuevoSaldo = Math.max(0, nuevaDeuda - Number(cxp.montoPagado));
					const nuevaDeudaFuncional = cxp.montoDeudaFuncional == null ||
						devolucion.montoImputadoFuncional == null
						? undefined
						: Number(cxp.montoDeudaFuncional) + Number(devolucion.montoImputadoFuncional);
					await tx.cuentaPorPagar.update({
						where: { cuentaPorPagarId: cxpId },
						data: {
						montoDeuda: nuevaDeuda,
						...(nuevaDeudaFuncional === undefined ? {} : { montoDeudaFuncional: nuevaDeudaFuncional }),
						saldoPendiente: nuevoSaldo,
						estado: nuevoSaldo === 0
							? 'PAGADA'
							: Number(cxp.montoPagado) === 0 ? 'PENDIENTE' : 'PARCIAL',
						},
					});
				}
			}

			return tx.devolucionCompra.update({
				where: { devolucionId },
				data: { estado: 'ANULADA' },
				include: { items: true },
			});
		});

		revalidatePath('/busy/compras-productos');
		return result;
	},
);
