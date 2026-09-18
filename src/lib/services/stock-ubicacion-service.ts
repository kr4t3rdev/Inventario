import { ActionError } from "@/lib/server-actions/types";

export type TipoUbicacion = "almacen" | "punto_venta";

type UpsertStockOpts =
	| {
			tenantId?: string;
			productoId: string;
			tipoUbicacion: TipoUbicacion;
			ubicacionId: string;
			modo: "increment";
			delta: number;
			/** Stock reservado (pedidos pendientes, etc.). Si se omite, preserva el valor existente. */
			cantidadReservada?: number;
	  }
	| {
			tenantId?: string;
			productoId: string;
			tipoUbicacion: TipoUbicacion;
			ubicacionId: string;
			modo: "set";
			valor: number;
			/** Stock reservado (pedidos pendientes, etc.). Si se omite, preserva el valor existente. */
			cantidadReservada?: number;
	  };

/**
 * @description Hace upsert del stock materializado por ubicación dentro de una transacción Prisma.
 * Usar modo 'increment' para compras, transferencias y ventas (delta puede ser negativo para decrementar).
 * Usar modo 'set' solo en inicialización o correcciones explícitas donde el valor absoluto
 * de la ubicación ya fue calculado fuera de este helper.
 *
 * @note StockUbicacion es la fuente de verdad operativa del inventario por ubicación.
 *   `producto.stock` permanece solo como compatibilidad legacy en algunos read models todavía no migrados.
 *   Las nuevas mutaciones NO deben depender de `producto.stock` ni asumir sincronización manual paralela.
 *
 * @param {any} tx - Cliente de transacción Prisma (o prisma directo)
 * @param {UpsertStockOpts} opts - Opciones de actualización
 * @returns {Promise<void>}
 */
export async function upsertStockUbicacion(
	tx: any,
	opts: UpsertStockOpts,
): Promise<void> {
	const {
		tenantId: explicitTenantId,
		productoId,
		tipoUbicacion,
		ubicacionId,
	} = opts;

	// tenantId es requerido por Prisma para el create del upsert.
	// Si no se pasa, se obtiene del producto (backward-compatible).
	const tenantId =
		explicitTenantId ??
		(
			await tx.producto.findUniqueOrThrow({
				where: { id: productoId },
				select: { tenantId: true },
			})
		).tenantId;

	if (opts.modo === "increment") {
		const { delta, cantidadReservada } = opts;
		const compositeWhere = {
			productoId_tipoUbicacion_ubicacionId: {
				productoId,
				tipoUbicacion,
				ubicacionId,
			},
		};
		const scalarWhere = { productoId, tipoUbicacion, ubicacionId };

		if (delta < 0 && cantidadReservada === undefined) {
			const result = await tx.stockUbicacion.updateMany({
				where: {
					...scalarWhere,
					cantidad: { gte: Math.abs(delta) },
					cantidadDisponible: { gte: Math.abs(delta) },
				},
				data: {
					cantidad: { increment: delta },
					cantidadDisponible: { increment: delta },
				},
			});

			if (result.count !== 1) {
				throw new ActionError(
					`Stock insuficiente en ${tipoUbicacion} ${ubicacionId}`,
					"STOCK_INSUFICIENTE",
				);
			}
			return;
		}

		if (cantidadReservada !== undefined) {
			// Si se provee cantidadReservada, leer registro existente para calcular disponible
			const existing = await tx.stockUbicacion.findUnique({
				where: compositeWhere,
				select: { cantidad: true, cantidadDisponible: true },
			});

			if (delta < 0) {
				const currentCantidad = existing?.cantidad ?? 0;
				const currentDisponible = existing?.cantidadDisponible ?? 0;
				const nextCantidad = currentCantidad + delta;
				const nextDisponible = nextCantidad - cantidadReservada;
				if (!existing || nextCantidad < 0 || nextDisponible < 0 || currentDisponible < 0) {
					throw new ActionError(
						`Stock insuficiente en ${tipoUbicacion} ${ubicacionId}`,
						"STOCK_INSUFICIENTE",
					);
				}

				const result = await tx.stockUbicacion.updateMany({
					where: {
						...scalarWhere,
						cantidad: currentCantidad,
						cantidadDisponible: currentDisponible,
					},
					data: {
						cantidad: { increment: delta },
						cantidadReservada,
						cantidadDisponible: nextDisponible,
					},
				});

				if (result.count !== 1) {
					throw new ActionError(
						"El stock cambió mientras se procesaba la operación",
						"STOCK_CONCURRENCIA",
					);
				}
				return;
			}

			await tx.stockUbicacion.upsert({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId,
						tipoUbicacion,
						ubicacionId,
					},
				},
				update: {
					cantidad: { increment: delta },
					cantidadReservada,
					cantidadDisponible:
						(existing ? existing.cantidad + delta : delta) - cantidadReservada,
				},
				create: {
					tenantId,
					productoId,
					tipoUbicacion,
					ubicacionId,
					cantidad: delta,
					cantidadReservada,
					cantidadDisponible: delta - cantidadReservada,
				},
			});
		} else {
			// Sin cantidadReservada: comportamiento legacy, disponible = cantidad
			await tx.stockUbicacion.upsert({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId,
						tipoUbicacion,
						ubicacionId,
					},
				},
				update: {
					cantidad: { increment: delta },
					cantidadDisponible: { increment: delta },
				},
				create: {
					tenantId,
					productoId,
					tipoUbicacion,
					ubicacionId,
					cantidad: delta,
					cantidadReservada: 0,
					cantidadDisponible: delta,
				},
			});
		}
	} else {
		const { valor, cantidadReservada } = opts;
		const reservada = cantidadReservada ?? 0;

		await tx.stockUbicacion.upsert({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId,
					tipoUbicacion,
					ubicacionId,
				},
			},
			update: {
				cantidad: valor,
				cantidadReservada: reservada,
				cantidadDisponible: valor - reservada,
			},
			create: {
				tenantId,
				productoId,
				tipoUbicacion,
				ubicacionId,
				cantidad: valor,
				cantidadReservada: reservada,
				cantidadDisponible: valor - reservada,
			},
		});
	}
}

// ─── Helpers transaccionales de alto nivel ───────────────────

interface MovimientoStockOpts {
	tenantId?: string;
	productoId: string;
	tipoUbicacion: TipoUbicacion;
	ubicacionId: string;
	cantidad: number;
	cantidadReservada?: number;
}

interface TransferirStockOpts {
	tenantId?: string;
	productoId: string;
	origenTipo: TipoUbicacion;
	origenId: string;
	destinoTipo: TipoUbicacion;
	destinoId: string;
	cantidad: number;
	cantidadReservada?: number;
}

/**
 * @description Incrementa el stock de una ubicación.
 * Conveniencia sobre upsertStockUbicacion con modo increment y delta positivo.
 *
 * @param tx - Cliente de transacción Prisma
 * @param opts - { tenantId?, productoId, tipoUbicacion, ubicacionId, cantidad, cantidadReservada? }
 */
export async function incrementarStock(
	tx: any,
	opts: MovimientoStockOpts,
): Promise<void> {
	const {
		tenantId,
		productoId,
		tipoUbicacion,
		ubicacionId,
		cantidad,
		cantidadReservada,
	} = opts;
	await upsertStockUbicacion(tx, {
		tenantId,
		productoId,
		tipoUbicacion,
		ubicacionId,
		modo: "increment",
		delta: cantidad,
		cantidadReservada,
	});
}

/**
 * @description Descuenta stock de una ubicación.
 * Conveniencia sobre upsertStockUbicacion con modo increment y delta negativo.
 *
 * @param tx - Cliente de transacción Prisma
 * @param opts - { tenantId?, productoId, tipoUbicacion, ubicacionId, cantidad, cantidadReservada? }
 */
export async function descontarStock(
	tx: any,
	opts: MovimientoStockOpts,
): Promise<void> {
	const {
		tenantId,
		productoId,
		tipoUbicacion,
		ubicacionId,
		cantidad,
		cantidadReservada,
	} = opts;
	await upsertStockUbicacion(tx, {
		tenantId,
		productoId,
		tipoUbicacion,
		ubicacionId,
		modo: "increment",
		delta: -cantidad,
		cantidadReservada,
	});
}

/**
 * @description Transfiere stock entre dos ubicaciones atómicamente.
 * Descuenta del origen y suma al destino en la misma transacción.
 *
 * @param tx - Cliente de transacción Prisma
 * @param opts - { tenantId?, productoId, origenTipo, origenId, destinoTipo, destinoId, cantidad, cantidadReservada? }
 */
export async function transferirStock(
	tx: any,
	opts: TransferirStockOpts,
): Promise<void> {
	const {
		tenantId,
		productoId,
		origenTipo,
		origenId,
		destinoTipo,
		destinoId,
		cantidad,
		cantidadReservada,
	} = opts;

	// Orden importante: descontar primero, sumar después
	await upsertStockUbicacion(tx, {
		tenantId,
		productoId,
		tipoUbicacion: origenTipo,
		ubicacionId: origenId,
		modo: "increment",
		delta: -cantidad,
		cantidadReservada,
	});

	await upsertStockUbicacion(tx, {
		tenantId,
		productoId,
		tipoUbicacion: destinoTipo,
		ubicacionId: destinoId,
		modo: "increment",
		delta: cantidad,
		cantidadReservada,
	});
}

/**
 * @description Revierte un movimiento de stock aplicando el delta inverso.
 * Útil para cancelaciones de ventas, transferencias, producción, etc.
 *
 * @param tx - Cliente de transacción Prisma
 * @param opts - { tenantId?, productoId, tipoUbicacion, ubicacionId, cantidad (delta original), cantidadReservada? }
 */
export async function revertirMovimiento(
	tx: any,
	opts: MovimientoStockOpts,
): Promise<void> {
	const {
		tenantId,
		productoId,
		tipoUbicacion,
		ubicacionId,
		cantidad,
		cantidadReservada,
	} = opts;
	await upsertStockUbicacion(tx, {
		tenantId,
		productoId,
		tipoUbicacion,
		ubicacionId,
		modo: "increment",
		delta: -cantidad,
		cantidadReservada,
	});
}
