/**
 * @description Server Actions para transferencias.
 *
 * @module features/transferencias/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireTenant } from "@/lib/services/tenant-scope";
import { notificarTransferencia } from "@/lib/notificaciones-utils";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import {
	getMovimientosDeOrigen,
	registrarMovimiento,
	revertirMovimientosDeOrigen,
} from "@/features/inventario/movimientos";
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
	// BUG-3: las transferencias canceladas/rechazadas o eliminadas lógicamente
	// no mueven stock; incluirlas distorsionaba el disponible del PV.
	const entrada = await prisma.transferencia.aggregate({
		where: {
			productoId,
			puntoDeVentaDestinoId: puntoDeVentaId,
			deletedAt: null,
			estado: { notIn: ["CANCELADA", "RECHAZADA"] },
		},
		_sum: { cantidad: true },
	});
	const salida = await prisma.transferencia.aggregate({
		where: {
			productoId,
			puntoDeVentaOrigenId: puntoDeVentaId,
			deletedAt: null,
			estado: { notIn: ["CANCELADA", "RECHAZADA"] },
		},
		_sum: { cantidad: true },
	});
	const [ventasItems, ventasLegacy] = await Promise.all([
		prisma.ventaItem.aggregate({
			where: {
				productoId,
				// Complemento del BUG-3: una venta anulada ya no consume stock.
				venta: { puntoDeVentaId, deletedAt: null, estado: { not: "ANULADA" } },
			},
			_sum: { cantidad: true },
		}),
		prisma.venta.aggregate({
			where: {
				productoId,
				puntoDeVentaId,
				deletedAt: null,
				estado: { not: "ANULADA" },
				items: { none: {} },
			},
			_sum: { cantidad: true },
		}),
	]);
	const ventasTotal =
		(ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0);
	return (
		(entrada._sum.cantidad || 0) - (salida._sum.cantidad || 0) - ventasTotal
	);
}

// B-01: el correlativo es por tenant (la unicidad es (tenantId, numeroTransferencia)).
async function generarNumeroTransferencia(tx: any, tenantId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await tx.transferencia.count({
		where: {
			tenantId,
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
			where: { tenantId, deletedAt: null },
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

		// Validar origen/destino (siempre con aislamiento por tenant)
		console.log("=== createTransferenciaAction :: validando origen ===", {
			tipoOrigen,
			origenId,
		});
		const origenValido =
			tipoOrigen === "almacen"
				? await prisma.almacen.findFirst({
						where: { almacenId: origenId, tenantId },
					})
				: await prisma.puntoDeVenta.findFirst({
						where: { pvId: origenId, tenantId },
					});
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
				? await prisma.almacen.findFirst({
						where: { almacenId: destinoId, tenantId },
					})
				: await prisma.puntoDeVenta.findFirst({
						where: { pvId: destinoId, tenantId },
					});
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

		// Crear en transacción con reintento ante colisión de numeración (P2002)
		// sobre el correlativo por tenant.
		const MAX_INTENTOS = 3;
		let result: any[] | null = null;
		for (let intento = 0; intento < MAX_INTENTOS; intento++) {
			try {
				result = await prisma.$transaction(async (tx: any) => {
					const transferenciasCreadas = [];
					const numeroTransferencia = await generarNumeroTransferencia(tx, tenantId);

			console.log("=== createTransferenciaAction :: numero generado ===", {
				numeroTransferencia,
			});

			for (const [
				idx,
				{ producto, cantidad },
			] of productosValidados.entries()) {
				const costoTotal = cantidad * producto.precioCosto;
				const data: any = {
					tenantId,
					productoId: producto.id,
					cantidad,
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
					await registrarMovimiento(tx, {
						tenantId,
						productoId: producto.id,
						tipoOrigen: "TRANSFERENCIA",
						origenId: transferencia.transferenciaId,
						tipoUbicacion: tipoOrigen,
						ubicacionId: origenId,
						cantidad: -cantidad,
						costoUnitario: producto.precioCosto,
						secuencia: `SALIDA-${idx}`,
						creadoPorId: user.userId,
					});
					await registrarMovimiento(tx, {
						tenantId,
						productoId: producto.id,
						tipoOrigen: "TRANSFERENCIA",
						origenId: transferencia.transferenciaId,
						tipoUbicacion: tipoDestino,
						ubicacionId: destinoId,
						cantidad,
						costoUnitario: producto.precioCosto,
						secuencia: `ENTRADA-${idx}`,
						creadoPorId: user.userId,
					});
				}

					transferenciasCreadas.push(transferencia);
				}
				return transferenciasCreadas;
				});
				break;
			} catch (error: unknown) {
				const esColision =
					(typeof (error as { code?: string })?.code === "string" &&
						(error as { code?: string }).code === "P2002");
				if (!esColision || intento === MAX_INTENTOS - 1) throw error;
				console.warn(`createTransferenciaAction: colisión de numeración, reintento ${intento + 2}`);
			}
		}
		if (!result) {
			throw new ActionError("No fue posible generar la numeración de la transferencia", "INTERNAL");
		}

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
				costoUnitario: true,
				origenId: true,
				destinoId: true,
				puntoDeVentaOrigenId: true,
				puntoDeVentaDestinoId: true,
				estado: true,
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

			// Solo resincronizar stock si la transferencia estaba COMPLETADA
			if (existing.estado === "COMPLETADA") {
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

				// Kardex: compensar el documento original y registrar la nueva versión.
				const originales = await getMovimientosDeOrigen(tx, {
					tenantId,
					tipoOrigen: "TRANSFERENCIA",
					origenId: transferenciaId,
				});
				const costoKardex =
					originales.find((m) => m.secuencia.startsWith("SALIDA"))
						?.costoUnitario ?? existing.costoUnitario ?? 0;

				await revertirMovimientosDeOrigen(tx, {
					tenantId,
					tipoOrigen: "TRANSFERENCIA",
					origenId: transferenciaId,
					creadoPorId: user.userId,
				});

				if (costoKardex > 0) {
					await registrarMovimiento(tx, {
						tenantId,
						productoId,
						tipoOrigen: "TRANSFERENCIA",
						origenId: transferenciaId,
						tipoUbicacion: tipoOrigen,
						ubicacionId: origenId,
						cantidad: -cantidad,
						costoUnitario: costoKardex,
						secuencia: "SALIDA-1",
						creadoPorId: user.userId,
					});
					await registrarMovimiento(tx, {
						tenantId,
						productoId,
						tipoOrigen: "TRANSFERENCIA",
						origenId: transferenciaId,
						tipoUbicacion: tipoDestino,
						ubicacionId: destinoId,
						cantidad,
						costoUnitario: costoKardex,
						secuencia: "ENTRADA-1",
						creadoPorId: user.userId,
					});
				}
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
			where: { transferenciaId: id, tenantId },
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

		// El soft-delete es idempotente: un reintento no debe volver a mover stock.
		if (transferencia.deletedAt) {
			revalidatePath("/busy/transferencias");
			return { success: true, id, message: "Transferencia ya cancelada" };
		}
		if (transferencia.estado === "CANCELADA") {
			// Compatibilidad con filas legacy CANCELADA sin deletedAt: ocúltala sin stock.
			await prisma.$transaction(async (tx: any) => {
				await tx.transferencia.updateMany({
					where: {
						transferenciaId: id,
						tenantId,
						deletedAt: null,
						estado: "CANCELADA",
					},
					data: { deletedAt: new Date() },
				});
			});
			revalidatePath("/busy/transferencias");
			return { success: true, id, message: "Transferencia ya cancelada" };
		}

		const result = await prisma.$transaction(async (tx: any) => {
			const current = await tx.transferencia.findUnique({
				where: { transferenciaId: id },
				select: {
					tenantId: true,
					deletedAt: true,
					estado: true,
					productoId: true,
					cantidad: true,
					origenId: true,
					destinoId: true,
					puntoDeVentaOrigenId: true,
					puntoDeVentaDestinoId: true,
				},
			});
			if (!current || current.tenantId !== tenantId)
				throw new ActionError("Transferencia no encontrada", "NOT_FOUND");
			if (current.deletedAt || current.estado === "CANCELADA")
				return { claimed: false as const, idempotent: true as const };

			// Reclamo atómico y tenant-scoped para impedir doble reversión concurrente.
			const claim = await tx.transferencia.updateMany({
				where: {
					transferenciaId: id,
					tenantId,
					deletedAt: null,
					estado: current.estado,
				},
				data: { estado: "CANCELADA", deletedAt: new Date() },
			});
			if (claim.count !== 1) {
				const latest = await tx.transferencia.findUnique({
					where: { transferenciaId: id },
					select: { tenantId: true, deletedAt: true, estado: true },
				});
				if (!latest || latest.tenantId !== tenantId)
					throw new ActionError("Transferencia no encontrada", "NOT_FOUND");
				if (latest.deletedAt || latest.estado === "CANCELADA") {
					return { claimed: false as const, idempotent: true as const };
				}
				throw new ActionError(
					"La transferencia cambió de estado; vuelve a cargarla e inténtalo de nuevo",
					"CONFLICT",
				);
			}

			// Solo revertir stock si la transferencia estaba COMPLETADA
			// (PENDIENTE/APROBADA nunca movieron stock)
			if (current.estado === "COMPLETADA") {
				const tipoOrigen = current.origenId
					? ("almacen" as const)
					: ("punto_venta" as const);
				const tipoDestino = current.destinoId
					? ("almacen" as const)
					: ("punto_venta" as const);
				const origenUbicacionId = (current.origenId ||
					current.puntoDeVentaOrigenId)!;
				const destinoUbicacionId = (current.destinoId ||
					current.puntoDeVentaDestinoId)!;

				await upsertStockUbicacion(tx, {
					tenantId,
					productoId: current.productoId,
					tipoUbicacion: tipoOrigen,
					ubicacionId: origenUbicacionId,
					modo: "increment",
					delta: current.cantidad,
				});
				await upsertStockUbicacion(tx, {
					tenantId,
					productoId: current.productoId,
					tipoUbicacion: tipoDestino,
					ubicacionId: destinoUbicacionId,
					modo: "increment",
					delta: -current.cantidad,
				});

				// Kardex: compensación de las líneas originales con su costo histórico.
				await revertirMovimientosDeOrigen(tx, {
					tenantId,
					tipoOrigen: "TRANSFERENCIA",
					origenId: id,
					creadoPorId: user.userId,
				});
			}
			return { claimed: true as const };
		});

		if (!result.claimed && result.idempotent) {
			revalidatePath("/busy/transferencias");
			return { success: true, id, message: "Transferencia ya cancelada" };
		}

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
		// B-01: la aprobación es decisión de jefatura (no del operador).
		requirePermission(user, "inventario.transferencias.aprobar", "aprobar transferencias");

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
		// La recepción física es operativa (a diferencia de aprobar/rechazar,
		// que son de jefatura): se exige el permiso de gestión de transferencias.
		requirePermission(user, "inventario.transferencias.gestionar", "completar transferencias");

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

		// B-01: recepción parcial — se mueve solo lo confirmado recibido.
		const cantidadRecibida = parsed.cantidadRecibida ?? cantidad;
		if (cantidadRecibida > cantidad) {
			throw new ActionError(
				`La cantidad recibida (${cantidadRecibida}) no puede superar la enviada (${cantidad})`,
				"VALIDATION_ERROR",
			);
		}
		const esParcial = cantidadRecibida < cantidad;

		const result = await prisma.$transaction(async (tx: any) => {
			const claim = await tx.transferencia.updateMany({
				where: {
					transferenciaId: parsed.transferenciaId,
					tenantId,
					deletedAt: null,
					estado: { in: ["APROBADA", "EN_TRANSITO"] },
				},
				data: {
					estado: "COMPLETADA",
					cantidadRecibida,
					...(esParcial
						? {
								descripcion: `Recepción parcial: ${cantidadRecibida} de ${cantidad} unidades recibidas`,
							}
						: {}),
				},
			});
			if (claim.count !== 1) {
				const current = await tx.transferencia.findUnique({
					where: { transferenciaId: parsed.transferenciaId },
					select: { tenantId: true, deletedAt: true, estado: true },
				});
				if (!current || current.tenantId !== tenantId)
					throw new ActionError("Transferencia no encontrada", "NOT_FOUND");
				if (current.deletedAt || current.estado === "CANCELADA")
					throw new ActionError("La transferencia ya no está disponible", "CONFLICT");
				if (current.estado === "COMPLETADA")
					return { alreadyCompleted: true as const };
				throw new ActionError(
					`La transferencia está en estado ${current.estado}, solo se pueden completar transferencias aprobadas o en tránsito`,
					"CONFLICT",
				);
			}

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
				delta: -cantidadRecibida,
			});
			await upsertStockUbicacion(tx, {
				productoId,
				tipoUbicacion: tipoDestino,
				ubicacionId: destinoUbicacionId,
				modo: "increment",
				delta: cantidadRecibida,
			});
			const costoUnitario = transferencia.costoUnitario ?? transferencia.producto.precioCosto;
			await registrarMovimiento(tx, {
				tenantId,
				productoId,
				tipoOrigen: "TRANSFERENCIA",
				origenId: transferencia.transferenciaId,
				tipoUbicacion: tipoOrigen,
				ubicacionId: origenUbicacionId,
				cantidad: -cantidadRecibida,
				costoUnitario,
				secuencia: "SALIDA-0",
				creadoPorId: user.userId,
			});
			await registrarMovimiento(tx, {
				tenantId,
				productoId,
				tipoOrigen: "TRANSFERENCIA",
				origenId: transferencia.transferenciaId,
				tipoUbicacion: tipoDestino,
				ubicacionId: destinoUbicacionId,
				cantidad: cantidadRecibida,
				costoUnitario,
				secuencia: "ENTRADA-0",
				creadoPorId: user.userId,
			});
			return { alreadyCompleted: false as const };
		});

		revalidatePath("/busy/transferencias");
		if (result.alreadyCompleted)
			return { success: true, message: "Transferencia ya completada" };
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
		// B-01: rechazar también es decisión de jefatura.
		requirePermission(user, "inventario.transferencias.aprobar", "rechazar transferencias");

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
