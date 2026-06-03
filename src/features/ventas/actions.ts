/**
 * @description Server Actions para el feature de Ventas.
 *
 * @module features/ventas/actions
 */
"use server";

import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/services/tenant-scope";
import { revalidatePath } from "next/cache";
import { createVentaSchema, anularVentaSchema } from "./schemas";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import type { CreateVentaInput, AnularVentaInput } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { applyFacturacionCobroWorkflow } from "./services/facturacion-workflow";
import { getOrCreateTurnoActivo } from "@/features/turnos-pos";

// ─── Select reutilizable ──────────────────────────────────

const VENTA_SELECT = {
	ventaId: true,
	tenantId: true,
	total: true,
	descuento: true,
	clienteId: true,
	empleadoId: true,
	puntoDeVentaId: true,
	observaciones: true,
	esVentaUnica: true,
	ofertaId: true,
	turnoId: true,
	metodoPago: true,
	montoEfectivo: true,
	montoTarjeta: true,
	montoTransferencia: true,
	montoCredito: true,
	createdAt: true,
	updatedAt: true,
	items: {
		select: {
			id: true,
			productoId: true,
			cantidad: true,
			precioUnitario: true,
			total: true,
			producto: { select: { id: true, nombre: true } },
		},
	},
	puntoDeVenta: { select: { pvId: true, nombre: true } },
	cliente: { select: { clienteId: true, nombre: true } },
	factura: { select: { idFactura: true, numeroFactura: true } },
} as const;

// ─── Server Actions ────────────────────────────────────────

/**
 * @description Lista todas las ventas del tenant.
 */
export const getVentasAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		return prisma.venta.findMany({
			where: { tenantId, deletedAt: null },
			select: VENTA_SELECT,
			orderBy: { createdAt: "desc" },
		});
	},
);

/**
 * @description Crea una venta con sus líneas y genera la factura correspondiente.
 * Calcula totales, descuenta stock, y maneja facturación.
 */
export const createVentaAction = withAction(
	async (input: CreateVentaInput, user: AuthenticatedUser) => {
		const parsed = createVentaSchema.parse(input);
		const tenantId = requireTenant(user);

		// Resolver turno activo
		let turnoId: string | null = parsed.turnoId ?? null;
		if (!turnoId) {
			const turnoResult = await getOrCreateTurnoActivo({
				puntoDeVentaId: parsed.puntoDeVentaId,
				empleadoId: parsed.empleadoId,
			});
			// getOrCreateTurnoActivo retorna ActionResponse, no el raw result
			if (turnoResult.success) {
				turnoId = turnoResult.data.turnoId;
			}
			// Si falla (ej: PRINCIPAL sin turno), se permite venta sin turno (legacy)
		}

		// Calcular totales de la venta
		const itemsData = parsed.items.map((item) => ({
			productoId: item.productoId,
			cantidad: item.cantidad,
			precioUnitario: item.precioUnitario,
			total: item.cantidad * item.precioUnitario,
		}));

		const subtotalVenta = itemsData.reduce((sum, item) => sum + item.total, 0);
		const totalVenta = subtotalVenta - (parsed.descuento ?? 0);
		const totalCantidad = itemsData.reduce(
			(sum, item) => sum + item.cantidad,
			0,
		);

		// Crear venta + factura en una transacción
		const result = await prisma.$transaction(async (tx) => {
			// 1. Obtener o crear serie de facturación por defecto para el tenant
			let serie = await tx.serieFacturacion.findFirst({
				where: { tenantId, esPorDefecto: true },
			});

			if (!serie) {
				serie = await tx.serieFacturacion.findFirst({
					where: { tenantId },
					orderBy: { createdAt: "asc" },
				});
			}

			if (!serie) {
				serie = await tx.serieFacturacion.create({
					data: {
						tenantId,
						prefijo: "FV",
						descripcion: "Facturas de Venta",
						consecutivo: 1,
						esPorDefecto: true,
					},
				});
			}

			// 2. Incrementar consecutivo
			const updatedSerie = await tx.serieFacturacion.update({
				where: { serieId: serie.serieId },
				data: { consecutivo: { increment: 1 } },
			});

			const numeroConsecutivo = updatedSerie.consecutivo - 1;
			const numeroFactura = `${serie.prefijo}-${String(numeroConsecutivo).padStart(6, "0")}`;

			// 3. Crear venta
			const venta = await tx.venta.create({
				data: {
					tenantId,
					puntoDeVentaId: parsed.puntoDeVentaId,
					clienteId: parsed.clienteId ?? null,
					empleadoId: parsed.empleadoId ?? null,
					turnoId,
					metodoPago: parsed.metodoPago ?? null,
					montoEfectivo: parsed.montoEfectivo ?? null,
					montoTarjeta: parsed.montoTarjeta ?? null,
					montoTransferencia: parsed.montoTransferencia ?? null,
					montoCredito: parsed.montoCredito ?? null,
					descuento: parsed.descuento ?? 0,
					observaciones: parsed.observaciones ?? null,
					total: Math.max(totalVenta, 0),
					cantidad: totalCantidad,
					esVentaUnica: true,
					items: {
						create: itemsData,
					},
				},
			});

			// 3b. Descontar stock por cada ítem vendido
			for (const item of itemsData) {
				const producto = await tx.producto.findUnique({
					where: { id: item.productoId },
					select: { id: true, stock: true, almacenId: true, tenantId: true },
				});

				if (!producto) {
					throw new ActionError(
						`Producto con ID ${item.productoId} no encontrado`,
						"NOT_FOUND",
					);
				}

				if (producto.stock < item.cantidad) {
					throw new ActionError(
						`Stock insuficiente para el producto. Disponible: ${producto.stock}, solicitado: ${item.cantidad}`,
						"STOCK_INSUFICIENTE",
					);
				}

				await tx.producto.update({
					where: { id: item.productoId },
					data: { stock: { decrement: item.cantidad } },
				});

				// Sincronizar StockUbicacion en el punto de venta
				if (producto.almacenId) {
					await upsertStockUbicacion(tx, {
						productoId: item.productoId,
						tipoUbicacion: "almacen",
						ubicacionId: producto.almacenId,
						modo: "increment",
						delta: -item.cantidad,
					});
				}
			}

			// 4. Crear factura solo si hay cliente (campo requerido en Factura)
			if (parsed.clienteId) {
				const factura = await tx.factura.create({
					data: {
						tenantId,
						serieId: serie.serieId,
						numeroConsecutivo,
						numeroFactura,
						tipoDocumento: "FACTURA",
						ventaId: venta.ventaId,
						clienteId: parsed.clienteId,
						subtotal: subtotalVenta,
						descuento: parsed.descuento ?? 0,
						cargoTransporte: 0,
						total: Math.max(totalVenta, 0),
						estado: "PENDIENTE",
						creadoPor: user.userId || "sistema",
						fechaVencimiento: parsed.fechaVencimiento
							? new Date(parsed.fechaVencimiento)
							: null,
						cuentaBancariaId: parsed.cuentaBancariaId || null,
					},
				});

				// 5. Aplicar workflow de cobro (reconciliación o cuenta por cobrar)
				if (parsed.tipoVencimiento || parsed.fechaVencimiento) {
					await applyFacturacionCobroWorkflow(tx, {
						ventaId: venta.ventaId,
						facturaId: factura.idFactura,
						clienteId: parsed.clienteId,
						montoTotal: Math.max(totalVenta, 0),
						usuarioId: user.userId || "sistema",
						tenantId,
						observaciones: parsed.observaciones,
						tipoVencimiento: parsed.tipoVencimiento || undefined,
						fechaVencimiento: parsed.fechaVencimiento || undefined,
						cuentaBancariaId: parsed.cuentaBancariaId || undefined,
					});
				}
			}

			return venta;
		});

		revalidatePath("/busy/sales");
		return result;
	},
);

/**
 * @description Anula una venta por ID.
 *
 * @throws ActionError si la venta no existe
 */
/**
 * @description Obtiene una venta por ID del tenant autenticado.
 *
 * @throws ActionError si la venta no existe
 */
export const getVentaByIdAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		const venta = await prisma.venta.findFirst({
			where: { ventaId: id, tenantId, deletedAt: null },
			select: VENTA_SELECT,
		});
		if (!venta) throw new ActionError("Venta no encontrada", "NOT_FOUND");
		return venta;
	},
);

/**
 * @description Actualiza datos básicos de una venta (no items).
 *
 * @throws ActionError si la venta no existe
 */
export const updateVentaAction = withAction(
	async (
		input: { ventaId: string } & Partial<{
			observaciones: string;
			descuento: number;
		}>,
		user: AuthenticatedUser,
	) => {
		const { ventaId, ...data } = input;
		const tenantId = requireTenant(user);
		const existing = await prisma.venta.findFirst({
			where: { ventaId, tenantId, deletedAt: null },
			select: { ventaId: true },
		});
		if (!existing) throw new ActionError("Venta no encontrada", "NOT_FOUND");
		const updated = await prisma.venta.update({
			where: { ventaId },
			data,
			select: VENTA_SELECT,
		});
		revalidatePath("/busy/sales");
		return updated;
	},
);

export const anularVentaAction = withAction(
	async (input: AnularVentaInput, user: AuthenticatedUser) => {
		const parsed = anularVentaSchema.parse(input);
		const tenantId = requireTenant(user);

		// Leer venta con sus items para restaurar stock
		const venta = await prisma.venta.findUnique({
			where: { ventaId: parsed.ventaId },
			select: {
				ventaId: true,
				tenantId: true,
				deletedAt: true,
				items: {
					select: {
						productoId: true,
						cantidad: true,
						producto: {
							select: { id: true, almacenId: true },
						},
					},
				},
			},
		});

		if (!venta) {
			throw new ActionError("Venta no encontrada", "NOT_FOUND");
		}

		if (venta.deletedAt) {
			throw new ActionError("La venta ya está anulada", "VALIDATION_ERROR");
		}

		// Restaurar stock en una transacción
		await prisma.$transaction(async (tx) => {
			for (const item of venta.items) {
				await tx.producto.update({
					where: { id: item.productoId },
					data: { stock: { increment: item.cantidad } },
				});

				if (item.producto?.almacenId) {
					await upsertStockUbicacion(tx, {
						productoId: item.productoId,
						tipoUbicacion: "almacen",
						ubicacionId: item.producto.almacenId,
						modo: "increment",
						delta: item.cantidad,
					});
				}
			}

			// Soft-delete: marcar como anulada
			await tx.venta.update({
				where: { ventaId: parsed.ventaId },
				data: {
					deletedAt: new Date(),
					observaciones: parsed.motivo
						? `ANULADA: ${parsed.motivo}`
						: "ANULADA",
				},
			});
		});

		revalidatePath("/busy/sales");
		return { ventaId: parsed.ventaId, anulada: true };
	},
);
