import { ActionError } from "@/lib/server-actions/types";

export type TipoUbicacion = "almacen" | "punto_venta";

type UpsertStockOpts =
	| {
			tenantId?: string;
			productoId: string;
			tipoUbicacion: TipoUbicacion;
			ubicacionId: string;
			ubicacionHijaId?: string | null;
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
			ubicacionHijaId?: string | null;
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
async function upsertStockUbicacionAgregado(
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

/**
 * @description Resuelve una hoja válida del almacén, creando `General` solo
 * para compatibilidad cuando aún no existe una hoja configurada.
 * @param {any} tx - Cliente Prisma transaccional.
 * @param {string} tenantId - Tenant de la operación.
 * @param {string} almacenId - Almacén cuyo árbol se consulta.
 * @param {string | undefined} ubicacionHijaId - Hoja explícita opcional.
 * @returns {Promise<string | null>} ID de hoja; null en clientes legacy simulados.
 */
async function resolverHojaStock(
	tx: any,
	tenantId: string,
	almacenId: string,
	ubicacionHijaId?: string,
): Promise<string | null> {
	if (!tx.ubicacion?.findFirst || !tx.stockUbicacionDetalle) return null;

	if (ubicacionHijaId) {
		const hoja = await tx.ubicacion.findFirst({
			where: {
				id: ubicacionHijaId,
				tenantId,
				almacenId,
				children: { none: {} },
			},
			select: { id: true },
		});
		if (!hoja) {
			throw new ActionError(
				'La ubicación hija no pertenece al almacén seleccionado o no es una hoja.',
				'UBICACION_HIJA_INVALIDA',
			);
		}
		return hoja.id;
	}

	const general = await tx.ubicacion.findFirst({
		where: {
			tenantId,
			almacenId,
			nombre: 'General',
			tipo: 'HOJA',
			children: { none: {} },
		},
		select: { id: true },
	});
	if (general) return general.id;

	const zoneId = `legacy-zone-${almacenId}`;
	const generalId = `legacy-general-${almacenId}`;
	await tx.ubicacion.upsert({
		where: { tenantId_almacenId_id: { tenantId, almacenId, id: zoneId } },
		create: {
			id: zoneId,
			tenantId,
			almacenId,
			nombre: 'Área general',
			tipo: 'ZONA',
		},
		update: {},
	});
	const hoja = await tx.ubicacion.upsert({
		where: { tenantId_almacenId_id: { tenantId, almacenId, id: generalId } },
		create: {
			id: generalId,
			tenantId,
			almacenId,
			parentId: zoneId,
			nombre: 'General',
			tipo: 'HOJA',
		},
		update: {},
		select: { id: true },
	});
	return hoja.id;
}

/**
 * @description Cambia saldo detallado por hoja con control optimista para
 * impedir cantidades negativas y conservar la igualdad con el agregado.
 * @param {any} tx - Cliente Prisma transaccional.
 * @param {object} input - Tenant, producto, almacén, hoja y delta.
 * @returns {Promise<void>} No devuelve valor.
 */
async function aplicarDeltaDetalle(
	tx: any,
	input: {
		tenantId: string;
		productoId: string;
		almacenId: string;
		ubicacionHijaId: string;
		delta: number;
		cantidadReservada?: number;
	},
): Promise<void> {
	const { tenantId, productoId, almacenId, ubicacionHijaId, delta } = input;
	const uniqueWhere = {
		tenantId_productoId_ubicacionHijaId: { tenantId, productoId, ubicacionHijaId },
	};
	const existing = await tx.stockUbicacionDetalle.findUnique({
		where: uniqueWhere,
		select: { cantidad: true, cantidadReservada: true, cantidadDisponible: true },
	});
	const cantidad = (existing?.cantidad ?? 0) + delta;
	const cantidadReservada = input.cantidadReservada ?? existing?.cantidadReservada ?? 0;
	const disponible = cantidad - cantidadReservada;
	if (cantidad < 0 || disponible < 0) {
		throw new ActionError('Stock insuficiente en la ubicación hija', 'STOCK_INSUFICIENTE');
	}

	if (!existing) {
		await tx.stockUbicacionDetalle.upsert({
			where: uniqueWhere,
			create: {
				tenantId, productoId, almacenId, ubicacionHijaId,
				cantidad, cantidadReservada, cantidadDisponible: disponible,
			},
			update: {
				cantidad: { increment: delta },
				cantidadReservada,
				cantidadDisponible: disponible,
			},
		});
		return;
	}

	const updated = await tx.stockUbicacionDetalle.updateMany({
		where: {
			tenantId,
			productoId,
			ubicacionHijaId,
			cantidad: existing.cantidad,
			cantidadDisponible: existing.cantidadDisponible,
		},
		data: {
			cantidad: { increment: delta },
			cantidadReservada,
			cantidadDisponible: disponible,
		},
	});
	if (updated.count !== 1) {
		throw new ActionError('El stock de la ubicación cambió durante la operación', 'STOCK_CONCURRENCIA');
	}
}

/**
 * @description Mantiene sincronizados el saldo agregado y su desglose por hoja.
 * Las salidas legacy se distribuyen por disponibilidad; las entradas van a
 * `General` salvo que el llamador indique una hoja.
 * @param {any} tx - Cliente Prisma transaccional.
 * @param {UpsertStockOpts} opts - Operación de actualización de stock.
 * @returns {Promise<void>} No devuelve valor.
 */
export async function upsertStockUbicacion(
	tx: any,
	opts: UpsertStockOpts,
): Promise<void> {
	if (typeof tx.$transaction === 'function') {
		await tx.$transaction((transaction: any) => upsertStockUbicacion(transaction, opts));
		return;
	}

	const tenantId = opts.tenantId ?? (
		await tx.producto.findUniqueOrThrow({
			where: { id: opts.productoId },
			select: { tenantId: true },
		})
	).tenantId;
	const hojaId = opts.tipoUbicacion === 'almacen'
		? await resolverHojaStock(tx, tenantId, opts.ubicacionId, opts.ubicacionHijaId ?? undefined)
		: null;

	await upsertStockUbicacionAgregado(tx, opts);
	if (!hojaId) return;

	if (opts.modo === 'increment') {
		if (opts.delta >= 0 || opts.ubicacionHijaId) {
			await aplicarDeltaDetalle(tx, {
				tenantId,
				productoId: opts.productoId,
				almacenId: opts.ubicacionId,
				ubicacionHijaId: hojaId,
				delta: opts.delta,
				cantidadReservada: opts.cantidadReservada,
			});
			return;
		}

		let restante = Math.abs(opts.delta);
		const hojas = await tx.stockUbicacionDetalle.findMany({
			where: { tenantId, productoId: opts.productoId, almacenId: opts.ubicacionId },
			orderBy: [{ ubicacionHijaId: 'asc' }, { id: 'asc' }],
			select: { ubicacionHijaId: true, cantidad: true, cantidadDisponible: true },
		});
		for (const hoja of hojas) {
			if (restante === 0) break;
			const tomar = Math.min(restante, hoja.cantidadDisponible);
			if (tomar <= 0) continue;
			await aplicarDeltaDetalle(tx, {
				tenantId,
				productoId: opts.productoId,
				almacenId: opts.ubicacionId,
				ubicacionHijaId: hoja.ubicacionHijaId,
				delta: -tomar,
			});
			restante -= tomar;
		}
		if (restante > 0) {
			throw new ActionError(
				'El detalle por ubicación no cuadra con el saldo agregado.',
				'STOCK_DETALLE_INCONSISTENTE',
			);
		}
		return;
	}

	const hojas = await tx.stockUbicacionDetalle.findMany({
		where: { tenantId, productoId: opts.productoId, almacenId: opts.ubicacionId },
		select: { ubicacionHijaId: true, cantidad: true },
	});
	const detalleActual = hojas.reduce((total: number, hoja: { cantidad: number }) => total + hoja.cantidad, 0);
	const delta = opts.valor - detalleActual;
	if (delta >= 0) {
		await aplicarDeltaDetalle(tx, {
			tenantId,
			productoId: opts.productoId,
			almacenId: opts.ubicacionId,
			ubicacionHijaId: hojaId,
			delta,
			cantidadReservada: opts.cantidadReservada,
		});
		return;
	}

	let restante = -delta;
	for (const hoja of hojas.sort((a: { ubicacionHijaId: string }, b: { ubicacionHijaId: string }) => a.ubicacionHijaId.localeCompare(b.ubicacionHijaId))) {
		if (restante === 0) break;
		const tomar = Math.min(restante, hoja.cantidad);
		if (tomar <= 0) continue;
		await aplicarDeltaDetalle(tx, {
			tenantId,
			productoId: opts.productoId,
			almacenId: opts.ubicacionId,
			ubicacionHijaId: hoja.ubicacionHijaId,
			delta: -tomar,
		});
		restante -= tomar;
	}
	if (restante > 0) {
		throw new ActionError('El detalle por ubicación no cuadra con el saldo agregado.', 'STOCK_DETALLE_INCONSISTENTE');
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
