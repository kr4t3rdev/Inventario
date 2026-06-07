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
 * Usar modo 'set' para restock (que ya calcula el valor absoluto nuevo).
 *
 * @note producto.stock (legacy): se actualiza manualmente en CADA calling action con el mismo delta.
 *   NO depende de este helper. Es un agregado legacy de compatibilidad mantenido en paralelo.
 *   Regla: toda mutación a StockUbicacion DEBE también actualizar producto.stock con el mismo delta,
 *   para mantener consistencia. En el futuro producto.stock será derivado explícitamente de
 *   SUM(StockUbicacion.cantidad) y este mantenimiento manual se eliminará.
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

		if (cantidadReservada !== undefined) {
			// Si se provee cantidadReservada, leer registro existente para calcular disponible
			const existing = await tx.stockUbicacion.findUnique({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId,
						tipoUbicacion,
						ubicacionId,
					},
				},
				select: { cantidad: true },
			});

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
