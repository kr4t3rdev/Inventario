/**
 * @description Server Actions para mermas.
 *
 * @module features/mermas/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/services/tenant-scope";
import { notificarMerma } from "@/lib/notificaciones-utils";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import {
	getMovimientosDeOrigen,
	registrarMovimiento,
	revertirMovimientosDeOrigen,
} from "@/features/inventario/movimientos";
import { createMermaSchema, updateMermaSchema } from "./schemas";
import type { CreateMermaInput, UpdateMermaInput } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

const MERMA_INCLUDE = {
  producto: true,
  creadoPor: { select: { userId: true, name: true } },
} as const;

export const getMermasAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		return prisma.merma.findMany({
			where: { tenantId },
			include: MERMA_INCLUDE,
			orderBy: { createdAt: "desc" },
		});
	},
);

export const getMermaByIdAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		const merma = await prisma.merma.findFirst({
			where: { mermaId: id, tenantId },
			include: MERMA_INCLUDE,
		});
		if (!merma) throw new ActionError("Merma no encontrada", "NOT_FOUND");
		return merma;
	},
);

export const createMermaAction = withAction(
	async (input: CreateMermaInput, user: AuthenticatedUser) => {
		const parsed = createMermaSchema.parse(input);
		const tenantId = requireTenant(user);

		const producto = await prisma.producto.findUnique({
			where: { id: parsed.productoId },
			select: {
				id: true,
				stock: true,
				precioCosto: true,
				tenantId: true,
				almacenId: true,
			},
		});
		if (!producto) throw new ActionError("Producto no encontrado", "NOT_FOUND");
		if (producto.tenantId !== tenantId)
			throw new ActionError("Producto no encontrado", "NOT_FOUND");

		const almacenIdEfectivo = parsed.almacenId ?? producto.almacenId;
		const stockUbicacion = await prisma.stockUbicacion.findUnique({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: parsed.productoId,
					tipoUbicacion: "almacen",
					ubicacionId: almacenIdEfectivo,
				},
			},
			select: { cantidadDisponible: true },
		});
		if (!stockUbicacion || stockUbicacion.cantidadDisponible < parsed.cantidad) {
			throw new ActionError(
				`Stock insuficiente en el almacén. Disponible: ${stockUbicacion?.cantidadDisponible ?? 0}`,
				"STOCK_INSUFICIENTE",
			);
		}

		const costoTotal = producto.precioCosto * parsed.cantidad;

		// Crear merma y actualizar stock en transacción
		const merma = await prisma.$transaction(async (tx: any) => {
			const creada = await tx.merma.create({
				data: {
					productoId: parsed.productoId,
					cantidad: parsed.cantidad,
					motivo: parsed.motivo ?? null,
					costoTotal,
					tenantId,
					almacenId: almacenIdEfectivo,
					creadoPorId: user.userId,
				},
				include: MERMA_INCLUDE,
			});

			await upsertStockUbicacion(tx, {
				productoId: parsed.productoId,
				tipoUbicacion: "almacen",
				ubicacionId: almacenIdEfectivo,
				modo: "increment",
				delta: -parsed.cantidad,
			});

			await registrarMovimiento(tx, {
				tenantId,
				productoId: parsed.productoId,
				tipoOrigen: "MERMA",
				origenId: creada.mermaId,
				tipoUbicacion: "almacen",
				ubicacionId: almacenIdEfectivo,
				cantidad: -parsed.cantidad,
				costoUnitario: producto.precioCosto,
				secuencia: "SALIDA-0",
				creadoPorId: user.userId,
			});

			return creada;
		});

		try {
			await notificarMerma(merma.mermaId);
		} catch (error) {
			console.error("Error enviando notificación de merma:", error);
		}

		revalidatePath("/busy/mermas");
		return merma;
	},
);

export const updateMermaAction = withAction(
	async (input: UpdateMermaInput, user: AuthenticatedUser) => {
		const parsed = updateMermaSchema.parse(input);
		const { mermaId, ...data } = parsed;
		const tenantId = requireTenant(user);

		const mermaActual = await prisma.merma.findFirst({
			where: { mermaId, tenantId },
			select: {
				mermaId: true,
				productoId: true,
				cantidad: true,
				tenantId: true,
				almacenId: true,
			},
		});
		if (!mermaActual) throw new ActionError("Merma no encontrada", "NOT_FOUND");

		const productoId = data.productoId ?? mermaActual.productoId;
		const cantidad = data.cantidad ?? mermaActual.cantidad;
		const nuevoAlmacenId = data.almacenId ?? mermaActual.almacenId;
		const oldAlmacenId = mermaActual.almacenId as string;

		const productoCambia = productoId !== mermaActual.productoId;
		const cantidadCambia = cantidad !== mermaActual.cantidad;
		const almacenCambia = data.almacenId !== undefined && nuevoAlmacenId !== oldAlmacenId;

		if (productoCambia || cantidadCambia || almacenCambia) {
			// Resolver almacén destino: si cambia producto, puede venir del producto nuevo
			let resolvedAlmacenId = nuevoAlmacenId as string;
			// Precio de costo vigente al momento de la edición para recalcular el costo.
			let precioCostoVigente: number | null = null;
			if (productoCambia) {
				const productoNuevo = await prisma.producto.findFirst({
					where: { id: productoId, tenantId },
					select: { id: true, almacenId: true, precioCosto: true },
				});
				if (!productoNuevo)
					throw new ActionError("Producto no encontrado", "NOT_FOUND");
				if (data.almacenId === undefined) {
					resolvedAlmacenId = productoNuevo.almacenId;
				}
				precioCostoVigente = productoNuevo.precioCosto;
			} else if (cantidadCambia) {
				const productoActual = await prisma.producto.findFirst({
					where: { id: productoId, tenantId },
					select: { precioCosto: true },
				});
				if (!productoActual)
					throw new ActionError("Producto no encontrado", "NOT_FOUND");
				precioCostoVigente = productoActual.precioCosto;
			}

			const cantidadAdicional =
				productoCambia || almacenCambia
					? cantidad
					: cantidad - mermaActual.cantidad;

			if (cantidadAdicional > 0) {
				const stockNuevo = await prisma.stockUbicacion.findUnique({
					where: {
						productoId_tipoUbicacion_ubicacionId: {
							productoId,
							tipoUbicacion: "almacen",
							ubicacionId: resolvedAlmacenId,
						},
					},
					select: { cantidadDisponible: true },
				});
				if (!stockNuevo || stockNuevo.cantidadDisponible < cantidadAdicional) {
					throw new ActionError("Stock insuficiente", "STOCK_INSUFICIENTE");
				}
			}

			const merma = await prisma.$transaction(async (tx: any) => {
			const updated = await tx.merma.update({
				where: { mermaId },
				data: {
					productoId,
					cantidad,
					motivo: data.motivo ?? undefined,
					almacenId: resolvedAlmacenId,
					...(precioCostoVigente !== null && {
						costoTotal: precioCostoVigente * cantidad,
					}),
				},
				include: MERMA_INCLUDE,
			});

			// Revertir stock del producto/almacén anterior
			await upsertStockUbicacion(tx, {
				productoId: mermaActual.productoId,
				tipoUbicacion: "almacen",
				ubicacionId: oldAlmacenId,
				modo: "increment",
				delta: mermaActual.cantidad,
			});
			// Compensar kardex de la merma original con su costo histórico
			const movimientosOriginales = await getMovimientosDeOrigen(tx, {
				tenantId,
				tipoOrigen: "MERMA",
				origenId: mermaId,
			});
			await revertirMovimientosDeOrigen(tx, {
				tenantId,
				tipoOrigen: "MERMA",
				origenId: mermaId,
				creadoPorId: user.userId,
			});

			// Aplicar stock al nuevo producto/almacén
			await upsertStockUbicacion(tx, {
				productoId,
				tipoUbicacion: "almacen",
				ubicacionId: resolvedAlmacenId,
				modo: "increment",
				delta: -cantidad,
			});

			// Kardex de la merma editada: costo vigente si se recalculó,
			// si no, el costo histórico del movimiento original.
			const costoUnitarioNuevo =
				precioCostoVigente ??
				movimientosOriginales.find((m) => m.secuencia === "SALIDA-0")
					?.costoUnitario;
			if (costoUnitarioNuevo !== undefined && costoUnitarioNuevo !== null) {
				await registrarMovimiento(tx, {
					tenantId,
					productoId,
					tipoOrigen: "MERMA",
					origenId: mermaId,
					tipoUbicacion: "almacen",
					ubicacionId: resolvedAlmacenId,
					cantidad: -cantidad,
					costoUnitario: costoUnitarioNuevo,
					secuencia: "SALIDA-1",
					creadoPorId: user.userId,
				});
			}

			return updated;
		});

			revalidatePath("/busy/mermas");
			return merma;
		}

		// Solo cambió el motivo — no tocar stock
		const merma = await prisma.merma.update({
			where: { mermaId },
			data: { motivo: data.motivo ?? undefined },
			include: MERMA_INCLUDE,
		});

		revalidatePath("/busy/mermas");
		return merma;
	},
);

export const deleteMermaAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		const merma = await prisma.merma.findFirst({
			where: { mermaId: id, tenantId },
			select: {
				mermaId: true,
				productoId: true,
				cantidad: true,
				almacenId: true,
			},
		});
		if (!merma) throw new ActionError("Merma no encontrada", "NOT_FOUND");

		await prisma.$transaction(async (tx: any) => {
			await revertirMovimientosDeOrigen(tx, {
				tenantId,
				tipoOrigen: "MERMA",
				origenId: merma.mermaId,
				creadoPorId: user.userId,
			});
			await tx.merma.delete({ where: { mermaId: id } });
			await upsertStockUbicacion(tx, {
				productoId: merma.productoId,
				tipoUbicacion: "almacen",
				ubicacionId: merma.almacenId!,
				modo: "increment",
				delta: merma.cantidad,
			});
		});

		revalidatePath("/busy/mermas");
		return { id, eliminado: true };
	},
);

export const getMermaStatsAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		const totalMermas = await prisma.merma.count({ where: { tenantId } });

		const fechaInicio = new Date();
		fechaInicio.setMonth(fechaInicio.getMonth() - 6);

		const mermasPorMes = await prisma.$queryRaw<{ mes: Date; total: number }[]>`
    SELECT 
      DATE_TRUNC('month', "createdAt") as mes,
      SUM("cantidad") as total
    FROM "Merma"
    WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${fechaInicio}
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY mes ASC
  `;

		return {
			totalMermas,
			mermasPorMes: mermasPorMes.map((item) => ({
				mes: new Date(item.mes).toISOString().slice(0, 7),
				total: Number(item.total),
			})),
		};
	},
);
