"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireFeature, requireTenant } from "@/lib/services/tenant-scope";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import {
	getMovimientosDeOrigen,
	registrarMovimiento,
	revertirMovimientosDeOrigen,
} from "@/features/inventario/movimientos";
import { PRODUCTION_STATES } from "@/lib/constants/production";
import {
	calcularCantidadRequeridaMaterial,
	validarDisponibilidadMateriales,
} from "@/lib/utils/produccion";
import { BomError, explodeBom } from "@/features/produccion/services/bom";
import { planificarNecesidades } from "@/features/produccion/services/mrp";
import { convertToBase } from "@/lib/utils/unit-converter";
import { emitirProduccionInventario } from "@/features/contabilidad-formal/services/inventory-adjustment-posting-service";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

/**
 * @description Convierte errores de validación BOM en errores de acción visibles para el cliente.
 * @param {() => T} operacion - Cálculo de dominio que puede lanzar `BomError`.
 * @returns {T} Resultado de la operación o error traducido.
 */
function ejecutarConErrorBom<T>(operacion: () => T): T {
	try {
		return operacion();
	} catch (error) {
		if (error instanceof BomError) throw new ActionError(error.message, error.code);
		throw error;
	}
}

export const planificarNecesidadesAction = withAction(
	async (input: { recetaId: string; cantidad: number }, user: AuthenticatedUser) => {
		requireFeature(user, 'mrp-avanzado', 'planificar necesidades de materiales');
		const tenantId = requireTenant(user);
		if (!input?.recetaId || !Number.isFinite(input.cantidad) || input.cantidad <= 0) {
			throw new ActionError('La receta y una cantidad mayor que cero son obligatorias', 'VALIDATION_ERROR');
		}

		const recetas = await prisma.receta.findMany({
			where: { tenantId },
			select: {
				recetaId: true,
				productoId: true,
				rendimiento: true,
				RecetaIngrediente: {
					select: {
						productoId: true,
						recetaIngredienteId: true,
						cantidad: true,
						desperdicio: true,
					},
				},
			},
		});
		const recipes = recetas.map((recipe) => ({
			recetaId: recipe.recetaId,
			productoId: recipe.productoId,
			rendimiento: recipe.rendimiento,
			ingredientes: recipe.RecetaIngrediente.map((ingredient) =>
				ingredient.recetaIngredienteId
					? {
						recetaIngredienteId: ingredient.recetaIngredienteId,
						cantidad: ingredient.cantidad,
						desperdicio: ingredient.desperdicio,
					}
					: {
						productoId: ingredient.productoId,
						cantidad: ingredient.cantidad,
						desperdicio: ingredient.desperdicio,
					},
			),
		}));
		const explosion = ejecutarConErrorBom(() =>
			explodeBom(input.recetaId, input.cantidad, recipes),
		);
		const recetaRaiz = recipes.find(({ recetaId }) => recetaId === input.recetaId);
		const productoIdsConDemanda = [...new Set([
			...explosion.materiales.map(({ productoId }) => productoId),
			...explosion.subrecipes.map(({ productoId }) => productoId)
				.filter((id): id is string => Boolean(id)),
			...(recetaRaiz?.productoId ? [recetaRaiz.productoId] : []),
		])];
		const balances = productoIdsConDemanda.length
			? await prisma.stockUbicacion.findMany({
					where: {
						tenantId,
						productoId: { in: productoIdsConDemanda },
					},
					select: { productoId: true, cantidadDisponible: true },
				})
			: [];

		return ejecutarConErrorBom(() =>
			planificarNecesidades(input.recetaId, input.cantidad, recipes, balances),
		);
	},
);

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
					// @ts-expect-error TODO: fix prisma include type
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
				// @ts-expect-error TODO: fix prisma include type
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
			data: {
				// `Receta.recetaId` y `Receta.updatedAt` no tienen valor por
				// defecto en el esquema: sin ellos la escritura falla.
				recetaId: crypto.randomUUID(),
				nombre: input.nombre,
				rendimiento: input.rendimiento ?? 1,
				instrucciones: input.instrucciones ?? null,
				tiempoPrep: input.tiempoPrep ?? null,
				productoId: input.productoId ?? null,
				tenantId,
				updatedAt: new Date(),
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
			// `Receta.updatedAt` no se administra sola: hay que marcarla.
			data: { ...data, updatedAt: new Date() },
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
			ingredientes: {
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
			where: { recetaId: input.recetaId, tenantId },
		});

		// Create new ingredients
		if (input.ingredientes.length > 0) {
			await prisma.recetaIngrediente.createMany({
				data: input.ingredientes.map((ing) => ({
					// `RecetaIngrediente.id` y `updatedAt` no tienen valor por
					// defecto en el esquema: sin ellos la escritura falla.
					id: crypto.randomUUID(),
					recetaId: input.recetaId,
					productoId: ing.productoId,
					cantidad: ing.cantidad,
					unidadSimbolo: ing.unidad,
					desperdicio: ing.desperdicio,
					tenantId,
					updatedAt: new Date(),
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
					// @ts-expect-error TODO: fix prisma include type
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
				// @ts-expect-error TODO: fix prisma include type
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
			// @ts-expect-error TODO: fix ing.producto type
			const costoProducto = ing.producto?.precioVenta ?? 0;
			return total + costoProducto * ing.cantidad;
		}, 0);

		const orden = await prisma.ordenProduccion.create({
			data: {
				// `OrdenProduccion.ordenProduccionId` y `updatedAt` no tienen
				// valor por defecto en el esquema: sin ellos la escritura falla.
				ordenProduccionId: crypto.randomUUID(),
				recetaId: input.recetaId,
				cantidad: input.cantidad,
				observaciones: input.observaciones ?? null,
				fechaProduccion: input.fechaProduccion,
				estado: "PENDIENTE",
				costoMateriales,
				tenantId,
				updatedAt: new Date(),
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

			const recetasAnidadas = await tx.receta.findMany({
				where: { tenantId },
				include: { RecetaIngrediente: true },
			});
			if (!recetasAnidadas.some((recipe) => recipe.recetaId === orden.recetaId)) {
				throw new ActionError("Receta no encontrada", "NOT_FOUND");
			}
			const recetasBom = recetasAnidadas.map((recipe) => ({
				recetaId: recipe.recetaId,
				productoId: recipe.productoId,
				rendimiento: recipe.rendimiento,
				ingredientes: recipe.RecetaIngrediente.map((ingredient) =>
					ingredient.recetaIngredienteId
						? {
							recetaIngredienteId: ingredient.recetaIngredienteId,
							cantidad: ingredient.cantidad,
							desperdicio: ingredient.desperdicio,
						}
						: {
							productoId: ingredient.productoId ?? '',
							cantidad: ingredient.cantidad,
							desperdicio: ingredient.desperdicio,
						},
				),
			}));

			let explosion;
			try {
				explosion = explodeBom(orden.recetaId, orden.cantidad, recetasBom);
			} catch (error) {
				if (error instanceof BomError) {
					throw new ActionError(error.message, error.code);
				}
				throw error;
			}

			// Validar disponibilidad de materiales hoja y descontar el stock agregado.
			const ingredientesConStock: Array<{
				productoId: string;
				cantidad: number;
				unidadSimbolo: string | null;
				desperdicio: number;
				almacenId?: string;
				producto?: { nombre: string; precioCosto: number; stock: number };
			}> = [];

			for (const material of explosion.materiales) {
				const producto = await tx.producto.findUnique({
					where: { id: material.productoId },
					select: {
						id: true,
						nombre: true,
						precioCosto: true,
						stock: true,
						almacenId: true,
					},
				});
				if (!producto) {
					throw new ActionError(
						`Producto ingrediente ${material.productoId} no encontrado`,
						"NOT_FOUND",
					);
				}
				const stockUbicacion = await tx.stockUbicacion.findUnique({
					where: {
						productoId_tipoUbicacion_ubicacionId: {
							productoId: material.productoId,
							tipoUbicacion: "almacen",
							ubicacionId: producto.almacenId ?? '',
						},
					},
					select: { cantidadDisponible: true },
				});

				ingredientesConStock.push({
					productoId: material.productoId,
					cantidad: material.cantidad,
					unidadSimbolo: null,
					desperdicio: 0,
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
				1,
			);

			if (materialesFaltantes.length > 0) {
				throw new ActionError(
					`Materiales insuficientes: ${materialesFaltantes.map((m: any) => m.nombre || m.productoId).join(", ")}`,
					"MATERIALES_INSUFICIENTES",
				);
			}

			// Descontar stock de cada ingrediente
			for (const [ingIdx, ing] of ingredientesConStock.entries()) {
				const cantidadRequerida = calcularCantidadRequeridaMaterial(
					ing,
					1,
				);

				if (ing.almacenId) {
					await upsertStockUbicacion(tx, {
						productoId: ing.productoId,
						tipoUbicacion: "almacen",
						ubicacionId: ing.almacenId,
						modo: "increment",
						delta: -cantidadRequerida,
					});
					await registrarMovimiento(tx as any, {
						tenantId,
						productoId: ing.productoId,
						tipoOrigen: "PRODUCCION",
						origenId: id,
						tipoUbicacion: "almacen",
						ubicacionId: ing.almacenId,
						cantidad: -Math.round(cantidadRequerida),
						costoUnitario: ing.producto?.precioCosto ?? 0,
						secuencia: `ING-${ingIdx}`,
						creadoPorId: user.userId,
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

			// El costo de salida proviene del Kardex consumido al aprobar la orden;
			// no se vuelve a valorar con precios que pudieron cambiar después.
			const movimientosConsumo = await getMovimientosDeOrigen(tx as any, {
				tenantId,
				tipoOrigen: "PRODUCCION",
				origenId: id,
			});
			const movimientosIngreso = movimientosConsumo.filter((movimiento) =>
				movimiento.secuencia.startsWith("ING-"),
			);
			let costoMateriales = movimientosIngreso.reduce(
				(total, movimiento) =>
					total + Math.abs(movimiento.cantidad) * movimiento.costoUnitario,
				0,
			);
			if (movimientosIngreso.length === 0) {
				// Órdenes aprobadas antes de la trazabilidad de kardex: conservar
				// la valoración histórica por receta para no completar con costo 0.
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
				await registrarMovimiento(tx as any, {
					tenantId,
					productoId,
					tipoOrigen: "PRODUCCION",
					origenId: id,
					tipoUbicacion: "almacen",
					ubicacionId: productoFinal.almacenId,
					cantidad: stockIncrementado,
					costoUnitario: stockIncrementado > 0
						? Math.round(costoMateriales / stockIncrementado)
						: 0,
					secuencia: "PRODUCTO-0",
					creadoPorId: user.userId,
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

			await emitirProduccionInventario(tx, {
				tenantId,
				userId: user.userId,
			}, {
				ordenProduccionId: id,
				fecha: new Date(),
				costoMaterialesCUP: costoMateriales,
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
			include: {
				Receta: {
					include: {
						Producto: true,
						RecetaIngrediente: { include: { Producto: true } },
					},
				},
			},
		});
		if (!orden) throw new ActionError("Orden no encontrada", "NOT_FOUND");
		if (orden.estado === "COMPLETADA")
			throw new ActionError(
				"No se puede cancelar una orden completada",
				"VALIDATION_ERROR",
			);

		// Si la orden estaba EN_PROCESO ya consumió materiales: reponer stock
		// y compensar el kardex de los ingredientes consumidos.
		if (orden.estado === "EN_PROCESO") {
			await prisma.$transaction(async (tx) => {
				const movimientosPrevios = await getMovimientosDeOrigen(tx as any, {
					tenantId,
					tipoOrigen: "PRODUCCION",
					origenId: id,
				});

				for (const mov of movimientosPrevios) {
					if (!mov.secuencia.startsWith("ING-")) continue;
					await upsertStockUbicacion(tx, {
						productoId: mov.productoId,
						tipoUbicacion: mov.tipoUbicacion as any,
						ubicacionId: mov.ubicacionId,
						modo: "increment",
						delta: -mov.cantidad,
					});
				}

				await revertirMovimientosDeOrigen(tx as any, {
					tenantId,
					tipoOrigen: "PRODUCCION",
					origenId: id,
					creadoPorId: user.userId,
				});
			});
		}

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
