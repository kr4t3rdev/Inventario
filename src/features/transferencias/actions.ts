/**
 * @description Server Actions para transferencias.
 *
 * @module features/transferencias/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/services/tenant-scope";
import { notificarTransferencia } from "@/lib/notificaciones-utils";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import {
	createTransferenciaSchema,
	updateTransferenciaSchema,
	aprobarTransferenciaSchema,
	completarTransferenciaSchema,
	rechazarTransferenciaSchema,
} from "./schemas";
import type {
	CreateTransferenciaInput,
	UpdateTransferenciaInput,
	AprobarTransferenciaInput,
	CompletarTransferenciaInput,
	RechazarTransferenciaInput,
} from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ─── Helpers ───────────────────────────────────────────────

async function getStockDisponibleEnPuntoVenta(
	productoId: string,
	puntoDeVentaId: string,
): Promise<number> {
	const entrada = await prisma.transferencia.aggregate({
		where: { productoId, puntoDeVentaDestinoId: puntoDeVentaId },
		_sum: { cantidad: true },
	});
	const salida = await prisma.transferencia.aggregate({
		where: { productoId, puntoDeVentaOrigenId: puntoDeVentaId },
		_sum: { cantidad: true },
	});
	const [ventasItems, ventasLegacy] = await Promise.all([
		prisma.ventaItem.aggregate({
			where: { productoId, venta: { puntoDeVentaId } },
			_sum: { cantidad: true },
		}),
		prisma.venta.aggregate({
			where: { productoId, puntoDeVentaId, items: { none: {} } },
			_sum: { cantidad: true },
		}),
	]);
	const ventasTotal =
		(ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0);
	return (
		(entrada._sum.cantidad || 0) - (salida._sum.cantidad || 0) - ventasTotal
	);
}

async function generarNumeroTransferencia(tx: any): Promise<string> {
	const year = new Date().getFullYear();
	const count = await tx.transferencia.count({
		where: {
			createdAt: {
				gte: new Date(`${year}-01-01`),
				lt: new Date(`${year + 1}-01-01`),
			},
		},
	});
	return `TRF-${year}-${String(count + 1).padStart(6, "0")}`;
}

function computeTipoYNombre(t: any) {
	let tipo = "",
		origenNombre = "",
		destinoNombre = "";
	if (t.origen) {
		origenNombre = `${t.origen.nombre} (Almacén)`;
		tipo += "Almacén";
	} else if (t.puntoDeVentaOrigen) {
		origenNombre = `${t.puntoDeVentaOrigen.nombre} (Punto de Venta)`;
		tipo += "Punto de Venta";
	}
	tipo += " → ";
	if (t.destino) {
		destinoNombre = `${t.destino.nombre} (Almacén)`;
		tipo += "Almacén";
	} else if (t.puntoDeVentaDestino) {
		destinoNombre = `${t.puntoDeVentaDestino.nombre} (Punto de Venta)`;
		tipo += "Punto de Venta";
	}
	return { tipoTransferencia: tipo, origenNombre, destinoNombre };
}

const TRANSFERENCIA_LIST_SELECT = {
	transferenciaId: true,
	numeroTransferencia: true,
	productoId: true,
	cantidad: true,
	costoUnitario: true,
	costoTotal: true,
	estado: true,
	createdAt: true,
	updatedAt: true,
	producto: { select: { nombre: true, codigoInterno: true } },
	origen: { select: { almacenId: true, nombre: true } },
	destino: { select: { almacenId: true, nombre: true } },
	puntoDeVentaOrigen: { select: { pvId: true, nombre: true } },
	puntoDeVentaDestino: { select: { pvId: true, nombre: true } },
	creadoPor: { select: { userId: true, name: true, email: true } },
} as const;

const TRANSFERENCIA_DETAIL_INCLUDE = {
	producto: true,
	origen: true,
	destino: true,
	puntoDeVentaOrigen: true,
	puntoDeVentaDestino: true,
	creadoPor: { select: { userId: true, name: true, email: true } },
} as const;

// ─── Server Actions ───────────────────────────────────────

export const getTransferenciasAction = withAction(
	async (
		input: { page?: number; limit?: number } = {},
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const page = input.page || 1;
		const limit = input.limit || 10;
		const skip = (page - 1) * limit;

		const transferencias = await prisma.transferencia.findMany({
			where: { tenantId, deletedAt: null },
			select: TRANSFERENCIA_LIST_SELECT,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		});

		const total = await prisma.transferencia.count({
			where: { deletedAt: null },
		});

		const transferenciasProcessed = transferencias.map((t: any) => {
			const { tipoTransferencia, origenNombre, destinoNombre } =
				computeTipoYNombre(t);
			return {
				transferenciaId: t.transferenciaId,
				numeroTransferencia: t.numeroTransferencia,
				productoId: t.productoId,
				productoNombre: t.producto.nombre,
				productoCodigoInterno: t.producto.codigoInterno,
				cantidad: t.cantidad,
				costoUnitario: t.costoUnitario,
				costoTotal: t.costoTotal,
				tipoTransferencia,
				origenNombre,
				destinoNombre,
				estado: t.estado,
				creadoPor: t.creadoPor,
				createdAt: t.createdAt,
				updatedAt: t.updatedAt,
			};
		});

		return {
			transferencias: transferenciasProcessed,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	},
);

export const getTransferenciaByIdAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		const t = await prisma.transferencia.findFirst({
			where: { transferenciaId: id, tenantId, deletedAt: null },
			include: TRANSFERENCIA_DETAIL_INCLUDE,
		});
		if (!t) throw new ActionError("Transferencia no encontrada", "NOT_FOUND");
		return t;
	},
);

export const createTransferenciaAction = withAction(
	async (input: CreateTransferenciaInput, user: AuthenticatedUser) => {
		console.log(
			"=== createTransferenciaAction :: input ===",
			JSON.parse(JSON.stringify(input)),
		);

		const parsed = createTransferenciaSchema.parse(input);
		const tenantId = requireTenant(user);
		const {
			productos,
			tipoOrigen,
			origenId,
			tipoDestino,
			destinoId,
			descripcion,
		} = parsed;

		console.log("=== createTransferenciaAction :: parsed ===", {
			tenantId,
			tipoOrigen,
			origenId,
			tipoDestino,
			destinoId,
			productosCount: productos.length,
		});

		if (tipoOrigen === tipoDestino && origenId === destinoId) {
			console.error("=== createTransferenciaAction :: origen === destino ===");
			throw new ActionError(
				"El origen y destino no pueden ser iguales",
				"VALIDATION_ERROR",
			);
		}

		// Validar productos
		const productosValidados: any[] = [];
		for (const item of productos) {
			console.log(
				"=== createTransferenciaAction :: validando producto ===",
				item,
			);

			const producto = await prisma.producto.findUnique({
				where: { id: item.productoId },
				select: {
					id: true,
					nombre: true,
					stock: true,
					precioCosto: true,
					tenantId: true,
				},
			});
			if (!producto || producto.tenantId !== tenantId) {
				console.error(
					"=== createTransferenciaAction :: producto no encontrado ===",
					{
						productoId: item.productoId,
						encontrado: !!producto,
						tenantMatch: producto?.tenantId === tenantId,
					},
				);
				throw new ActionError(
					`Producto con ID ${item.productoId} no encontrado`,
					"NOT_FOUND",
				);
			}

			if (tipoOrigen === "punto_venta") {
				const stockDisponible = await getStockDisponibleEnPuntoVenta(
					item.productoId,
					origenId,
				);
				console.log("=== createTransferenciaAction :: stock punto_venta ===", {
					producto: producto.nombre,
					solicitado: item.cantidad,
					disponible: stockDisponible,
				});
				if (stockDisponible < item.cantidad)
					throw new ActionError(
						`Stock insuficiente para ${producto.nombre} en el punto de venta`,
						"STOCK_INSUFICIENTE",
					);
			} else {
				const stockAlmacen = await prisma.stockUbicacion.findUnique({
					where: {
						productoId_tipoUbicacion_ubicacionId: {
							productoId: item.productoId,
							tipoUbicacion: "almacen",
							ubicacionId: origenId,
						},
					},
					select: { cantidadDisponible: true },
				});
				if (!stockAlmacen) {
					throw new ActionError(
						`El producto ${producto.nombre} no tiene registro de stock en el almacén origen`,
						"STOCK_INCONSISTENTE",
					);
				}
				if (stockAlmacen.cantidadDisponible < item.cantidad) {
					console.error(
						"=== createTransferenciaAction :: stock insuficiente ===",
						{
							producto: producto.nombre,
							solicitado: item.cantidad,
							disponible: stockAlmacen.cantidadDisponible,
						},
					);
					throw new ActionError(
						`Stock insuficiente para ${producto.nombre}. Disponible: ${stockAlmacen.cantidadDisponible}`,
						"STOCK_INSUFICIENTE",
					);
				}
			}
			productosValidados.push({ producto, cantidad: item.cantidad });
		}

		// Validar origen/destino
		console.log("=== createTransferenciaAction :: validando origen ===", {
			tipoOrigen,
			origenId,
		});
		const origenValido =
			tipoOrigen === "almacen"
				? await prisma.almacen.findUnique({ where: { almacenId: origenId } })
				: await prisma.puntoDeVenta.findUnique({ where: { pvId: origenId } });
		if (!origenValido) {
			console.error(
				"=== createTransferenciaAction :: origen no encontrado ===",
				{ tipoOrigen, origenId },
			);
			throw new ActionError("Origen no encontrado", "NOT_FOUND");
		}

		console.log("=== createTransferenciaAction :: validando destino ===", {
			tipoDestino,
			destinoId,
		});
		const destinoValido =
			tipoDestino === "almacen"
				? await prisma.almacen.findUnique({ where: { almacenId: destinoId } })
				: await prisma.puntoDeVenta.findUnique({ where: { pvId: destinoId } });
		if (!destinoValido) {
			console.error(
				"=== createTransferenciaAction :: destino no encontrado ===",
				{ tipoDestino, destinoId },
			);
			throw new ActionError("Destino no encontrado", "NOT_FOUND");
		}

		// Crear en transacción
		console.log("=== createTransferenciaAction :: iniciando transacción ===", {
			productosCount: productosValidados.length,
			numeroTransferencia: "",
		});

		const result = await prisma.$transaction(async (tx: any) => {
			const transferenciasCreadas = [];
			const numeroTransferencia = await generarNumeroTransferencia(tx);

			console.log("=== createTransferenciaAction :: numero generado ===", {
				numeroTransferencia,
			});

			for (const [
				idx,
				{ producto, cantidad },
			] of productosValidados.entries()) {
				const costoTotal = cantidad * producto.precioCosto;
				const data: any = {
					producto: { connect: { id: producto.id } },
					cantidad,
					tenant: { connect: { tenantId } },
					costoUnitario: producto.precioCosto,
					costoTotal,
					descripcion: descripcion || `Transferencia - ${producto.nombre}`,
					estado: parsed.estado ?? "COMPLETADA",
					creadoPorId: user.userId,
					numeroTransferencia: `${numeroTransferencia}-${String(transferenciasCreadas.length + 1).padStart(3, "0")}`,
				};
				if (tipoOrigen === "almacen") data.origenId = origenId;
				else data.puntoDeVentaOrigenId = origenId;
				if (tipoDestino === "almacen") data.destinoId = destinoId;
				else data.puntoDeVentaDestinoId = destinoId;

				console.log(
					`=== createTransferenciaAction :: create[${idx}] data ===`,
					JSON.parse(JSON.stringify(data)),
				);

				const transferencia = await tx.transferencia.create({ data });

				const estadoFinal = parsed.estado ?? "COMPLETADA";
				console.log(`=== createTransferenciaAction :: stockDelta[${idx}] ===`, {
					stockDelta:
						(tipoOrigen === "almacen" ? -cantidad : 0) +
						(tipoDestino === "almacen" ? cantidad : 0),
				});

				if (estadoFinal === "COMPLETADA") {
					await upsertStockUbicacion(tx, {
						productoId: producto.id,
						tipoUbicacion: tipoOrigen,
						ubicacionId: origenId,
						modo: "increment",
						delta: -cantidad,
					});
					await upsertStockUbicacion(tx, {
						productoId: producto.id,
						tipoUbicacion: tipoDestino,
						ubicacionId: destinoId,
						modo: "increment",
						delta: cantidad,
					});
				}

				transferenciasCreadas.push(transferencia);
			}
			return transferenciasCreadas;
		});

		console.log("=== createTransferenciaAction :: transacción OK ===", {
			creadas: result.length,
			ids: result.map((t: any) => t.transferenciaId),
		});

		for (const t of result) {
			try {
				console.log(
					"=== createTransferenciaAction :: notificando ===",
					t.transferenciaId,
				);
				await notificarTransferencia(t.transferenciaId);
			} catch (e) {
				console.error(
					"=== createTransferenciaAction :: notificación falló ===",
					e,
				);
			}
		}

		revalidatePath("/busy/transferencias");
		return {
			message: `${result.length} transferencias creadas`,
			transferencias: result,
			totalProductos: result.length,
		};
	},
);

export const updateTransferenciaAction = withAction(
	async (input: UpdateTransferenciaInput, user: AuthenticatedUser) => {
		const parsed = updateTransferenciaSchema.parse(input);
		const tenantId = requireTenant(user);
		const {
			transferenciaId,
			productoId,
			cantidad,
			tipoOrigen,
			origenId,
			tipoDestino,
			destinoId,
		} = parsed;

		const existing = await prisma.transferencia.findFirst({
			where: { transferenciaId, tenantId, deletedAt: null },
			select: {
				productoId: true,
				cantidad: true,
				origenId: true,
				destinoId: true,
				puntoDeVentaOrigenId: true,
				puntoDeVentaDestinoId: true,
			},
		});
		if (!existing)
			throw new ActionError("Transferencia no encontrada", "NOT_FOUND");

		const oldProductoId = existing.productoId!;
		const oldTipoOrigen = existing.origenId ? "almacen" : "punto_venta";
		const oldOrigenId = existing.origenId ?? existing.puntoDeVentaOrigenId;
		const oldTipoDestino = existing.destinoId ? "almacen" : "punto_venta";
		const oldDestinoId = existing.destinoId ?? existing.puntoDeVentaDestinoId;

		const oldCantidad = existing.cantidad;
		const origenCambio =
			oldTipoOrigen !== tipoOrigen || oldOrigenId !== origenId;
		const destinoCambio =
			oldTipoDestino !== tipoDestino || oldDestinoId !== destinoId;
		const cantidadCambio = oldCantidad !== cantidad;
		const productoCambio = oldProductoId !== productoId;

		if (!origenCambio && !destinoCambio && !cantidadCambio && !productoCambio) {
			return { message: "Sin cambios", transferencia: existing as any };
		}

		const result = await prisma.$transaction(async (tx: any) => {
			const updateData: Record<string, unknown> = {
				productoId,
				cantidad,
			};

			if (tipoOrigen === "almacen") {
				updateData.origenId = origenId;
				updateData.puntoDeVentaOrigenId = null;
			} else {
				updateData.origenId = null;
				updateData.puntoDeVentaOrigenId = origenId;
			}

			if (tipoDestino === "almacen") {
				updateData.destinoId = destinoId;
				updateData.puntoDeVentaDestinoId = null;
			} else {
				updateData.destinoId = null;
				updateData.puntoDeVentaDestinoId = destinoId;
			}

			await tx.transferencia.update({
				where: { transferenciaId },
				data: updateData,
			});

			const syncOrigen = origenCambio || cantidadCambio || productoCambio;
			const syncDestino = destinoCambio || cantidadCambio || productoCambio;

			// ── Revertir movimiento anterior (oldProductoId) ──
			if (syncOrigen) {
				await upsertStockUbicacion(tx, {
					productoId: oldProductoId,
					tipoUbicacion: oldTipoOrigen as "almacen" | "punto_venta",
					ubicacionId: oldOrigenId!,
					modo: "increment",
					delta: oldCantidad,
				});
			}
			if (syncDestino) {
				await upsertStockUbicacion(tx, {
					productoId: oldProductoId,
					tipoUbicacion: oldTipoDestino as "almacen" | "punto_venta",
					ubicacionId: oldDestinoId!,
					modo: "increment",
					delta: -oldCantidad,
				});
			}

			// ── Aplicar movimiento nuevo (new productoId) ──
			if (syncOrigen) {
				await upsertStockUbicacion(tx, {
					productoId,
					tipoUbicacion: tipoOrigen as "almacen" | "punto_venta",
					ubicacionId: origenId,
					modo: "increment",
					delta: -cantidad,
				});
			}
			if (syncDestino) {
				await upsertStockUbicacion(tx, {
					productoId,
					tipoUbicacion: tipoDestino as "almacen" | "punto_venta",
					ubicacionId: destinoId,
					modo: "increment",
					delta: cantidad,
				});
			}

			const updated = await tx.transferencia.findUnique({
				where: { transferenciaId },
			});
			return updated;
		});

		revalidatePath("/busy/transferencias");
		return { message: "Transferencia actualizada", transferencia: result };
	},
);

export const deleteTransferenciaAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		const transferencia = await prisma.transferencia.findFirst({
			where: { transferenciaId: id, tenantId, deletedAt: null },
			include: {
				producto: true,
				origen: true,
				destino: true,
				puntoDeVentaOrigen: true,
				puntoDeVentaDestino: true,
			},
		});
		if (!transferencia)
			throw new ActionError("Transferencia no encontrada", "NOT_FOUND");
		if (transferencia.estado === "CANCELADA")
			throw new ActionError(
				"La transferencia ya está cancelada",
				"VALIDATION_ERROR",
			);

		await prisma.$transaction(async (tx: any) => {
			await tx.transferencia.update({
				where: { transferenciaId: id },
				data: { estado: "CANCELADA", deletedAt: new Date() },
			});

			// Revertir StockUbicacion (Fase 3)
			const tipoOrigen = transferencia.origenId
				? ("almacen" as const)
				: ("punto_venta" as const);
			const tipoDestino = transferencia.destinoId
				? ("almacen" as const)
				: ("punto_venta" as const);
			const origenUbicacionId = (transferencia.origenId ||
				transferencia.puntoDeVentaOrigenId)!;
			const destinoUbicacionId = (transferencia.destinoId ||
				transferencia.puntoDeVentaDestinoId)!;

			await upsertStockUbicacion(tx, {
				productoId: transferencia.productoId,
				tipoUbicacion: tipoOrigen,
				ubicacionId: origenUbicacionId,
				modo: "increment",
				delta: transferencia.cantidad, // revertir lo que salió
			});
			await upsertStockUbicacion(tx, {
				productoId: transferencia.productoId,
				tipoUbicacion: tipoDestino,
				ubicacionId: destinoUbicacionId,
				modo: "increment",
				delta: -transferencia.cantidad, // revertir lo que llegó
			});
		});

		revalidatePath("/busy/transferencias");
		return { success: true, id, message: "Transferencia cancelada" };
	},
);

/**
 * @description Aprueba una transferencia PENDIENTE y mueve el stock.
 * Transición: PENDIENTE → APROBADA. El stock se descuenta del origen y se suma al destino.
 */
export const aprobarTransferenciaAction = withAction(
	async (input: AprobarTransferenciaInput, user: AuthenticatedUser) => {
		const parsed = aprobarTransferenciaSchema.parse(input);
		const tenantId = requireTenant(user);

		const transferencia = await prisma.transferencia.findFirst({
			where: {
				transferenciaId: parsed.transferenciaId,
				tenantId,
				deletedAt: null,
			},
			include: { producto: true },
		});
		if (!transferencia)
			throw new ActionError("Transferencia no encontrada", "NOT_FOUND");
		if (transferencia.estado !== "PENDIENTE") {
			throw new ActionError(
				`La transferencia está en estado ${transferencia.estado}, solo se pueden aprobar transferencias pendientes`,
				"VALIDATION_ERROR",
			);
		}

		await prisma.$transaction(async (tx: any) => {
			await tx.transferencia.update({
				where: { transferenciaId: parsed.transferenciaId },
				data: { estado: "APROBADA" },
			});

			// No mover stock aún — se mueve al completar
		});

		revalidatePath("/busy/transferencias");
		return { success: true, message: "Transferencia aprobada" };
	},
);

/**
 * @description Completa una transferencia APROBADA o EN_TRANSITO, moviendo el stock definitivamente.
 * Transición: {APROBADA, EN_TRANSITO} → COMPLETADA. El stock se descuenta del origen y se suma al destino.
 */
export const completarTransferenciaAction = withAction(
	async (input: CompletarTransferenciaInput, user: AuthenticatedUser) => {
		const parsed = completarTransferenciaSchema.parse(input);
		const tenantId = requireTenant(user);

		const transferencia = await prisma.transferencia.findFirst({
			where: {
				transferenciaId: parsed.transferenciaId,
				tenantId,
				deletedAt: null,
			},
			include: { producto: true },
		});
		if (!transferencia)
			throw new ActionError("Transferencia no encontrada", "NOT_FOUND");
		if (!["APROBADA", "EN_TRANSITO"].includes(transferencia.estado)) {
			throw new ActionError(
				`La transferencia está en estado ${transferencia.estado}, solo se pueden completar transferencias aprobadas o en tránsito`,
				"VALIDATION_ERROR",
			);
		}

		const {
			cantidad,
			productoId,
			origenId,
			destinoId,
			puntoDeVentaOrigenId,
			puntoDeVentaDestinoId,
		} = transferencia;

		await prisma.$transaction(async (tx: any) => {
			await tx.transferencia.update({
				where: { transferenciaId: parsed.transferenciaId },
				data: { estado: "COMPLETADA" },
			});

			// Sincronizar StockUbicacion
			const origenEsAlmacen = !!origenId;
			const destinoEsAlmacen = !!destinoId;
			const tipoOrigen = origenEsAlmacen
				? ("almacen" as const)
				: ("punto_venta" as const);
			const tipoDestino = destinoEsAlmacen
				? ("almacen" as const)
				: ("punto_venta" as const);
			const origenUbicacionId = (origenId || puntoDeVentaOrigenId)!;
			const destinoUbicacionId = (destinoId || puntoDeVentaDestinoId)!;

			await upsertStockUbicacion(tx, {
				productoId,
				tipoUbicacion: tipoOrigen,
				ubicacionId: origenUbicacionId,
				modo: "increment",
				delta: -cantidad,
			});
			await upsertStockUbicacion(tx, {
				productoId,
				tipoUbicacion: tipoDestino,
				ubicacionId: destinoUbicacionId,
				modo: "increment",
				delta: cantidad,
			});
		});

		revalidatePath("/busy/transferencias");
		return { success: true, message: "Transferencia completada" };
	},
);

/**
 * @description Rechaza una transferencia PENDIENTE. No mueve stock.
 * Transición: PENDIENTE → RECHAZADA.
 */
export const rechazarTransferenciaAction = withAction(
	async (input: RechazarTransferenciaInput, user: AuthenticatedUser) => {
		const parsed = rechazarTransferenciaSchema.parse(input);
		const tenantId = requireTenant(user);

		const transferencia = await prisma.transferencia.findFirst({
			where: {
				transferenciaId: parsed.transferenciaId,
				tenantId,
				deletedAt: null,
			},
		});
		if (!transferencia)
			throw new ActionError("Transferencia no encontrada", "NOT_FOUND");
		if (transferencia.estado !== "PENDIENTE") {
			throw new ActionError(
				`La transferencia está en estado ${transferencia.estado}, solo se pueden rechazar transferencias pendientes`,
				"VALIDATION_ERROR",
			);
		}

		await prisma.transferencia.update({
			where: { transferenciaId: parsed.transferenciaId },
			data: {
				estado: "RECHAZADA",
				descripcion: parsed.motivo,
			},
		});

		revalidatePath("/busy/transferencias");
		return { success: true, message: "Transferencia rechazada" };
	},
);
