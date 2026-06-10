"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireFeature, requireTenant } from "@/lib/services/tenant-scope";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import { PRODUCTION_STATES } from "@/lib/constants/production";
import {
	calcularCantidadRequeridaMaterial,
	validarDisponibilidadMateriales,
} from "@/lib/utils/produccion";
import { convertToBase } from "@/lib/utils/unit-converter";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ==================== RECETAS ====================

export const getRecetasProduccionAction = withAction(
	async (
		filters: {
			search?: string;
			productoId?: string;
			page?: number;
			limit?: number;
		} = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);
		const { search, productoId, page = 1, limit = 20 } = filters;

		const where: any = { tenantId };
		if (search) {
			where.nombre = { contains: search, mode: "insensitive" };
		}
		if (productoId) {
			where.productoId = productoId;
		}

		const [recetas, total] = await Promise.all([
			prisma.receta.findMany({
				where,
				include: {
					// @ts-expect-error
					producto: true,
					RecetaIngrediente: { include: { Producto: true } },
				},
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
			}),
			prisma.receta.count({ where }),
		]);

		return {
			data: recetas,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	},
);

export const getRecetaProduccionByIdAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);
		const receta = await prisma.receta.findFirst({
			where: { recetaId: id, tenantId },
			include: {
				// @ts-expect-error
				producto: true,
				RecetaIngrediente: { include: { Producto: true } },
			},
		});
		if (!receta) throw new ActionError("Receta no encontrada", "NOT_FOUND");
		return receta;
	},
);

export const createRecetaProduccionAction = withAction(
	async (
		input: {
			nombre: string;
			rendimiento?: number;
			instrucciones?: string | null;
			tiempoPrep?: number | null;
			productoId?: string | null;
		},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);
		const receta = await prisma.receta.create({
			// @ts-expect-error
			data: {
				nombre: input.nombre,
				rendimiento: input.rendimiento ?? 1,
				instrucciones: input.instrucciones ?? null,
				tiempoPrep: input.tiempoPrep ?? null,
				productoId: input.productoId ?? null,
				tenantId,
			},
			include: { Producto: true, RecetaIngrediente: true },
		});
		revalidatePath("/busy/produccion");
		return receta;
	},
);

export const updateRecetaProduccionAction = withAction(
	async (
		input: {
			recetaId: string;
			nombre?: string;
			rendimiento?: number;
			instrucciones?: string | null;
			tiempoPrep?: number | null;
			productoId?: string | null;
		},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);
		const { recetaId, ...data } = input;

		const existing = await prisma.receta.findFirst({
			where: { recetaId, tenantId },
		});
		if (!existing) throw new ActionError("Receta no encontrada", "NOT_FOUND");

		const receta = await prisma.receta.update({
			where: { recetaId },
			data,
			include: { Producto: true, RecetaIngrediente: true },
		});
		revalidatePath("/busy/produccion");
		return receta;
	},
);

export const deleteRecetaProduccionAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);
		const existing = await prisma.receta.findFirst({
			where: { recetaId: id, tenantId },
		});
		if (!existing) throw new ActionError("Receta no encontrada", "NOT_FOUND");

		await prisma.receta.delete({ where: { recetaId: id } });
		revalidatePath("/busy/produccion");
		return { id, eliminado: true };
	},
);

export const setIngredientesRecetaProduccionAction = withAction(
	async (
		input: {
			recetaId: string;
			RecetaIngrediente: {
				productoId: string;
				cantidad: number;
				unidad: string;
				desperdicio: number;
			}[];
		},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);

		// Verify recipe exists
		const receta = await prisma.receta.findFirst({
			where: { recetaId: input.recetaId, tenantId },
		});
		if (!receta) throw new ActionError("Receta no encontrada", "NOT_FOUND");

		// Delete existing ingredients
		await prisma.recetaIngrediente.deleteMany({
			where: { recetaId: input.recetaId },
		});

		// Create new ingredients
		// @ts-expect-error
		if (input.ingredientes.length > 0) {
			await prisma.recetaIngrediente.createMany({
				// @ts-expect-error
				data: input.ingredientes.map((ing: any) => ({
					recetaId: input.recetaId,
					productoId: ing.productoId,
					cantidad: ing.cantidad,
					unidad: ing.unidad,
					desperdicio: ing.desperdicio,
					tenantId,
				})),
			});
		}

		const updated = await prisma.receta.findUnique({
			where: { recetaId: input.recetaId },
			include: {
				Producto: true,
				RecetaIngrediente: { include: { Producto: true } },
			},
		});
		revalidatePath("/busy/produccion");
		return updated;
	},
);

// ==================== ÓRDENES DE PRODUCCIÓN ====================

export const getOrdenesProduccionAction = withAction(
	async (
		filters: { estado?: string; page?: number; limit?: number } = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);
		const { estado, page = 1, limit = 20 } = filters;

		const where: any = { tenantId };
		if (estado) {
			where.estado = estado;
		}

		const [ordenes, total] = await Promise.all([
			prisma.ordenProduccion.findMany({
				where,
				include: {
					// @ts-expect-error
					receta: {
						include: {
							Producto: true,
							RecetaIngrediente: { include: { Producto: true } },
						},
					},
				},
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
			}),
			prisma.ordenProduccion.count({ where }),
		]);

		return {
			data: ordenes,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	},
);

export const getOrdenProduccionByIdAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);
		const orden = await prisma.ordenProduccion.findFirst({
			where: { ordenProduccionId: id, tenantId },
			include: {
				// @ts-expect-error
				receta: {
					include: {
						Producto: true,
						RecetaIngrediente: { include: { Producto: true } },
					},
				},
			},
		});
		if (!orden)
			throw new ActionError("Orden de producción no encontrada", "NOT_FOUND");
		return orden;
	},
);

export const createOrdenProduccionAction = withAction(
	async (
		input: {
			recetaId: string;
			cantidad: number;
			observaciones?: string | null;
			fechaProduccion: string;
		},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);

		// Verify recipe exists
		const receta = await prisma.receta.findFirst({
			where: { recetaId: input.recetaId, tenantId },
		});
		if (!receta) throw new ActionError("Receta no encontrada", "NOT_FOUND");

		// Calculate materials cost
		const ingredientes = await prisma.recetaIngrediente.findMany({
			where: { recetaId: input.recetaId },
			include: { Producto: true },
		});

		const costoMateriales = ingredientes.reduce((total, ing) => {
			// @ts-expect-error
			const costoProducto = ing.producto?.precioVenta ?? 0;
			return total + costoProducto * ing.cantidad;
		}, 0);

		const orden = await prisma.ordenProduccion.create({
			// @ts-expect-error
			data: {
				recetaId: input.recetaId,
				cantidad: input.cantidad,
				observaciones: input.observaciones ?? null,
				fechaProduccion: input.fechaProduccion,
				estado: "PENDIENTE",
				costoMateriales,
				tenantId,
			},
			include: {
				Receta: {
					include: {
						Producto: true,
						RecetaIngrediente: { include: { Producto: true } },
					},
				},
			},
		});

		revalidatePath("/busy/produccion");
		return orden;
	},
);

export const aprobarOrdenProduccionAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);

		const result = await prisma.$transaction(async (tx) => {
			// Leer orden con receta e ingredientes
			const orden = await tx.ordenProduccion.findUnique({
				where: { ordenProduccionId: id },
				include: {
					Receta: {
						include: { RecetaIngrediente: true },
					},
				},
			});

			if (!orden) throw new ActionError("Orden no encontrada", "NOT_FOUND");
			if (String(orden.estado) !== PRODUCTION_STATES.PENDIENTE) {
				throw new ActionError(
					"La orden no está en estado pendiente",
					"VALIDATION_ERROR",
				);
			}

			// Validar disponibilidad de materiales y descontar stock
			const ingredientesConStock: Array<{
				productoId: string;
				cantidad: number;
				unidadSimbolo: string | null;
				desperdicio: number;
				almacenId?: string;
				producto?: { nombre: string; precioCosto: number; stock: number };
			}> = [];

			for (const ingrediente of orden.Receta.RecetaIngrediente) {
				const producto = await tx.producto.findUnique({
					where: { id: ingrediente.productoId },
					select: {
						id: true,
						nombre: true,
						precioCosto: true,
						stock: true,
						almacenId: true,
					},
				});
				const stockUbicacion = await tx.stockUbicacion.findUnique({
					where: {
						productoId_tipoUbicacion_ubicacionId: {
							productoId: ingrediente.productoId,
							tipoUbicacion: "almacen",
							ubicacionId: producto?.almacenId,
						},
					},
					select: { cantidadDisponible: true },
				});

				if (!producto) {
					throw new ActionError(
						`Producto ingrediente ${ingrediente.productoId} no encontrado`,
						"NOT_FOUND",
					);
				}

				ingredientesConStock.push({
					productoId: ingrediente.productoId,
					cantidad: ingrediente.cantidad,
					unidadSimbolo: ingrediente.unidadSimbolo ?? null,
					desperdicio: ingrediente.desperdicio ?? 0,
					almacenId: producto.almacenId,
					producto: {
						nombre: producto.nombre,
						precioCosto: producto.precioCosto,
						stock: stockUbicacion?.cantidadDisponible ?? 0,
					},
				});
			}

			// Verificar que haya suficiente stock
			const materialesFaltantes = validarDisponibilidadMateriales(
				ingredientesConStock,
				orden.cantidad,
			);

			if (materialesFaltantes.length > 0) {
				throw new ActionError(
					`Materiales insuficientes: ${materialesFaltantes.map((m: any) => m.nombre || m.productoId).join(", ")}`,
					"MATERIALES_INSUFICIENTES",
				);
			}

			// Descontar stock de cada ingrediente
			for (const ing of ingredientesConStock) {
				const cantidadRequerida = calcularCantidadRequeridaMaterial(
					ing,
					orden.cantidad,
				);

				if (ing.almacenId) {
					await upsertStockUbicacion(tx, {
						productoId: ing.productoId,
						tipoUbicacion: "almacen",
						ubicacionId: ing.almacenId,
						modo: "increment",
						delta: -cantidadRequerida,
					});
				}
			}

			// Actualizar estado de la orden
			const ordenActualizada = await tx.ordenProduccion.update({
				where: { ordenProduccionId: id },
				data: { estado: PRODUCTION_STATES.EN_PROCESO },
				include: { Receta: { include: { Producto: true } } },
			});

			await tx.ordenProduccionHistorial.create({
				data: {
					ordenProduccionId: id,
					tenantId,
					estadoAnterior: PRODUCTION_STATES.PENDIENTE,
					estadoNuevo: PRODUCTION_STATES.EN_PROCESO,
					observaciones: "Orden aprobada - materiales reservados",
					usuarioId: user.userId,
				},
			});

			return ordenActualizada;
		});

		revalidatePath("/busy/produccion");
		return result;
	},
);

export const completarOrdenProduccionAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);

		const result = await prisma.$transaction(async (tx) => {
			// Leer orden con receta completa
			const orden = await tx.ordenProduccion.findUnique({
				where: { ordenProduccionId: id },
				include: {
					Receta: {
						include: {
							Producto: true,
							RecetaIngrediente: true,
						},
					},
				},
			});

			if (!orden) throw new ActionError("Orden no encontrada", "NOT_FOUND");
			if (String(orden.estado) !== PRODUCTION_STATES.EN_PROCESO) {
				throw new ActionError(
					"La orden debe estar aprobada para completar",
					"VALIDATION_ERROR",
				);
			}

			if (!orden.Receta.Producto) {
				throw new ActionError(
					"Producto final no configurado para esta receta",
					"VALIDATION_ERROR",
				);
			}

			const productoId = orden.Receta.productoId;
			if (!productoId) {
				throw new ActionError(
					"Producto final no configurado para esta receta",
					"VALIDATION_ERROR",
				);
			}

			const productoFinal = await tx.producto.findUnique({
				where: { id: productoId },
				select: { id: true, almacenId: true, stock: true },
			});

			if (!productoFinal) {
				throw new ActionError(
					"Producto final no encontrado en catálogo",
					"NOT_FOUND",
				);
			}

			// Calcular costo real de materiales
			let costoMateriales = 0;
			for (const ingrediente of orden.Receta.RecetaIngrediente) {
				const factorDesperdicio = 1 + (ingrediente.desperdicio ?? 0);
				const cantidadBase = convertToBase(
					ingrediente.cantidad,
					ingrediente.unidadSimbolo,
				);
				const cantidadUsada = cantidadBase * factorDesperdicio * orden.cantidad;

				const producto = await tx.producto.findUnique({
					where: { id: ingrediente.productoId },
				});
				if (producto) {
					costoMateriales += producto.precioCosto * cantidadUsada;
				}
			}

			// Incrementar stock del producto final
			const stockIncrementado = orden.cantidad * orden.Receta.rendimiento;
			if (productoFinal.almacenId) {
				await upsertStockUbicacion(tx, {
					productoId,
					tipoUbicacion: "almacen",
					ubicacionId: productoFinal.almacenId,
					modo: "increment",
					delta: stockIncrementado,
				});
			}

			// Actualizar orden
			const ordenActualizada = await tx.ordenProduccion.update({
				where: { ordenProduccionId: id },
				data: {
					estado: PRODUCTION_STATES.COMPLETADA,
					costoMateriales,
				},
				include: {
					Receta: {
						include: {
							Producto: { select: { id: true, nombre: true } },
							RecetaIngrediente: {
								include: {
									Producto: {
										select: {
											id: true,
											nombre: true,
											precioCosto: true,
											stock: true,
										},
									},
								},
							},
						},
					},
				},
			});

			await tx.ordenProduccionHistorial.create({
				data: {
					ordenProduccionId: id,
					tenantId,
					estadoAnterior: PRODUCTION_STATES.EN_PROCESO,
					estadoNuevo: PRODUCTION_STATES.COMPLETADA,
					observaciones: `Producción completada. Costo de materiales: ${costoMateriales}. Stock incrementado: ${stockIncrementado}`,
					usuarioId: user.userId,
				},
			});

			return ordenActualizada;
		});

		revalidatePath("/busy/produccion");
		return result;
	},
);

export const cancelarOrdenProduccionAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'produccion', 'gestionar producción');
		const tenantId = requireTenant(user);

		const orden = await prisma.ordenProduccion.findFirst({
			where: { ordenProduccionId: id, tenantId },
		});
		if (!orden) throw new ActionError("Orden no encontrada", "NOT_FOUND");
		if (orden.estado === "COMPLETADA")
			throw new ActionError(
				"No se puede cancelar una orden completada",
				"VALIDATION_ERROR",
			);

		const updated = await prisma.ordenProduccion.update({
			where: { ordenProduccionId: id },
			data: { estado: "CANCELADA" },
			include: { Receta: { include: { Producto: true } } },
		});

		await prisma.ordenProduccionHistorial.create({
			data: {
				ordenProduccionId: id,
				estadoAnterior: orden.estado,
				estadoNuevo: "CANCELADA",
				tenantId,
			},
		});

		revalidatePath("/busy/produccion");
		return updated;
	},
);
