"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireTenant, requirePermission, requireFeature } from "@/lib/services/tenant-scope";
import { withPeriodValidation } from "@/lib/services/with-period-validation";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import { executeProductInstanceCreationWorkflow } from "@/lib/restock-utils";
import { recordCostChange, CostChangeReason } from "@/lib/cost-history-utils";
import { restockSchema } from "./schemas";
import type { RestockInput } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import type {
	RestockHistoryQueryInput,
	RestockHistoryResponse,
	RestockHistoryItem,
} from "./types";
// ─── Select reutilizable para restock ─────────────────────

const PRODUCTO_RESTOOK_SELECT = {
	id: true,
	nombre: true,
	descripcion: true,
	codigoInterno: true,
	precioCosto: true,
	precioVenta: true,
	stock: true,
	fotos: true,
	categoriaId: true,
	subcategoriaId: true,
	unidadId: true,
	vendorId: true,
	almacenId: true,
	puntoDeVentaId: true,
	tenantId: true,
	proveedorCodigo: true,
	codigoNegocio: true,
	stockMinimo: true,
	esCompuesto: true,
	categoria: { select: { catId: true, nombre: true } },
	unidad: { select: { unidadId: true, simbolo: true } },
	vendor: { select: { vendorId: true, nombre: true } },
	almacen: { select: { almacenId: true, nombre: true } },
} as const;

/**
 * @description Realiza un restock de producto: actualiza stock, crea GastoCompra,
 *   gestiona flujo de pagos (completo o parcial) y maneja conversión de monedas.
 *
 * Replica la lógica core de restockProductoHandler como Server Action.
 * El handler legacy se mantiene como fallback (no se elimina).
 *
 * @param input - Payload del restock validado con restockSchema
 * @returns { success, data: { producto, gastoCompra } }
 * @throws ActionError en caso de producto no encontrado, cuenta inactiva, etc.
 */
export const restockProductoAction = withAction(
	withPeriodValidation(
		() => new Date(),
		async (input: RestockInput, user: AuthenticatedUser) => {
			requirePermission(user, 'inventario.productos.restock', 'hacer restock de productos');
			const parsed = restockSchema.parse(input);
			const {
				productoId,
				cantidad,
				precioCosto,
				precioVenta,
				descripcion,
				numeroFactura,
				facturaUrl,
				formaPago,
				estado,
				moneda,
				tasaCambio,
				montoConvertido,
				monedaOriginal,
				montoOriginal,
				cuentaId: cuentaIdParam,
				tipoRestock,
			} = parsed;

			if (formaPago?.toUpperCase() === "PAGO_PARCIAL") {
				requireFeature(user, "cuentas-pagar", "crear cuentas por pagar desde restock");
			}

			const tenantId = requireTenant(user);

			// ── 1. Verificar existencia del producto ──
			const producto = await prisma.producto.findUnique({
				where: { id: productoId },
				include: {
					categoria: true,
					unidad: true,
					vendor: true,
					almacen: true,
				},
			});

			if (!producto) {
				throw new ActionError("Producto no encontrado", "NOT_FOUND");
			}

			// ── 2. Ejecutar workflow de instancia ──
			const forceNewInstance = tipoRestock === "nueva_instancia";
			const forceSumStock = tipoRestock === "sumar_stock";

			const workflowResult = executeProductInstanceCreationWorkflow({
				currentProduct: {
					id: producto.id,
					nombre: producto.nombre,
					descripcion: producto.descripcion,
					codigoInterno: producto.codigoInterno,
					precioCosto: producto.precioCosto,
					precioVenta: producto.precioVenta,
					stock: producto.stock,
					stockMinimo: producto.stockMinimo,
					fotos: producto.fotos || [],
					categoriaId: producto.categoriaId,
					unidadId: producto.unidadId,
					vendorId: producto.vendorId,
					almacenId: producto.almacenId,
					puntoDeVentaId: producto.puntoDeVentaId,
				},
				restockQuantity: cantidad,
				newCostPrice: precioCosto,
				newSellingPrice: precioVenta,
				forceNewInstance,
				forceSumStock,
			});

			// ── 3. Transacción: stock + gastos + pagos ──
			const result = await prisma.$transaction(
				async (tx) => {
					let updatedProducto: any = null;
					let newProductInstance: typeof producto | null = null;
					let gastoCompra: Awaited<ReturnType<typeof tx.gastoCompra.create>>;
					let compraProducto: Awaited<
						ReturnType<typeof tx.compraProducto.create>
					> | null = null;

					const now = new Date();
					const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

					// ── 3a. Crear nueva instancia si aplica ──
					if (workflowResult.needsNewInstance && workflowResult.newInstance) {
						// Copiar precios de listas desde el producto original
						const preciosOriginales = await tx.precioProducto.findMany({
							where: { productoId: producto.id },
							select: { listaPrecioId: true, precio: true },
						});

						newProductInstance = await tx.producto.create({
							data: {
								...workflowResult.newInstance.data,
								tenantId,
								productoPadreId: producto.id, // Vincular con el producto original
								...(preciosOriginales.length > 0
									? {
											precios: {
												create: preciosOriginales.map((p) => ({
													listaPrecioId: p.listaPrecioId,
													precio: p.precio,
												})),
											},
										}
									: {}),
							},
							include: {
								categoria: true,
								unidad: true,
								vendor: true,
								almacen: true,
							},
						});

						const targetProducto = newProductInstance;
						const costPrice = precioCosto ?? targetProducto.precioCosto;
						const totalCost = cantidad * costPrice;

						// GastoCompra asociado a la nueva instancia
						gastoCompra = await tx.gastoCompra.create({
							data: {
								productoId: targetProducto.id,
								vendorId: targetProducto.vendorId!,
								cantidad,
								precioUnitario: costPrice,
								total: totalCost,
								fechaCompra: now,
								descripcion:
									descripcion || `Restock - ${targetProducto.nombre}`,
								periodo,
								numeroFactura: numeroFactura || undefined,
								tenantId,
							},
						});

						// CompraProducto asociado
						if (tx.compraProducto?.create) {
							compraProducto = await tx.compraProducto.create({
								data: {
									productoId: targetProducto.id,
									proveedorId: targetProducto.vendorId ?? "",
									numeroFactura: numeroFactura || "",
									facturaUrl: facturaUrl || "",
									cantidad,
									precioUnitario: costPrice,
									total: totalCost,
									formaPago: formaPago || "PAGO_COMPLETO",
									estado: estado || "PAGADA",
									tipoOperacion: "RESTOCK",
									descripcion:
										descripcion || `Restock - ${targetProducto.nombre}`,
									fechaCompra: now,
									gastoCompraId: gastoCompra.gastoCompraId,
									tenantId,
								},
							});
						}

						// ── Upsert StockUbicacion para la nueva instancia ──
						await upsertStockUbicacion(tx, {
							productoId: targetProducto.id,
							tipoUbicacion: "almacen",
							ubicacionId: targetProducto.almacenId!,
							modo: "set",
							valor: targetProducto.stock,
						});

						// ── Flujo de pagos para nueva instancia ──
						const targetProductoFinal = targetProducto;

						await handlePaymentInTransaction(tx, {
							formaPagoFinal: (formaPago || "PAGO_COMPLETO").toUpperCase(),
							cuentaIdParam,
							totalCost,
							monedaOriginal,
							montoOriginal,
							tasaCambio,
							montoConvertido,
							periodo,
							productoNombre: targetProductoFinal.nombre,
							userId: user.userId,
							gastoCompraId: gastoCompra.gastoCompraId,
							vendorId: targetProductoFinal.vendorId!,
							vendorNombre:
								targetProductoFinal.vendor?.nombre ||
								"Proveedor no especificado",
							numeroFactura,
							now,
							compraProductoId: compraProducto?.compraProductoId,
							tenantId,
						});
					} else {
						// ── 3b. Actualizar stock del producto original ──
						const updateData: Record<string, unknown> = {
							stock: workflowResult.originalProductUpdate.newStock,
						};
						if (precioCosto !== undefined) {
							updateData.precioCosto =
								workflowResult.originalProductUpdate.newPrecioCosto;
						}
						if (precioVenta !== undefined) {
							updateData.precioVenta =
								workflowResult.originalProductUpdate.newPrecioVenta;
						}

						updatedProducto = await tx.producto.update({
							where: { id: productoId },
							data: updateData,
							include: {
								categoria: true,
								unidad: true,
								vendor: true,
								almacen: true,
							},
						});

						// Upsert StockUbicacion
						await upsertStockUbicacion(tx, {
							productoId,
							tipoUbicacion: "almacen",
							ubicacionId: producto.almacenId!,
							modo: "increment",
							delta: cantidad,
						});

						// Registrar cambio de precio en historial
						if (precioCosto !== undefined || precioVenta !== undefined) {
							try {
								await recordCostChange(
									tx as any,
									{
										productoId: producto.id,
										oldPrecioCosto: producto.precioCosto,
										newPrecioCosto: updatedProducto.precioCosto,
										oldPrecioVenta: producto.precioVenta,
										newPrecioVenta: updatedProducto.precioVenta,
										reason: CostChangeReason.RESTOCK,
										changedBy:
											((user as unknown as Record<string, unknown>).userId as string) ||
											"system",
										notes: `Restock x${cantidad} - ${descripcion || ""}`.trim(),
									},
								);
							} catch (_chErr) {
								console.error(
									"Error registrando cost history (no bloqueante):",
									_chErr,
								);
							}
						}

						const costPrice = precioCosto ?? producto.precioCosto;
						const totalCost = cantidad * costPrice;

						// GastoCompra
						gastoCompra = await tx.gastoCompra.create({
							data: {
								productoId: producto.id,
								vendorId: producto.vendorId!,
								cantidad,
								precioUnitario: costPrice,
								total: totalCost,
								fechaCompra: now,
								descripcion: descripcion || `Restock - ${producto.nombre}`,
								periodo,
								numeroFactura: numeroFactura || undefined,
								tenantId,
							},
						});

						// CompraProducto
						if (tx.compraProducto?.create) {
							compraProducto = await tx.compraProducto.create({
								data: {
									productoId: producto.id,
									proveedorId: producto.vendorId ?? "",
									numeroFactura: numeroFactura || "",
									facturaUrl: facturaUrl || "",
									cantidad,
									precioUnitario: costPrice,
									total: totalCost,
									formaPago: formaPago || "PAGO_COMPLETO",
									estado: estado || "PAGADA",
									tipoOperacion: "RESTOCK",
									descripcion: descripcion || `Restock - ${producto.nombre}`,
									fechaCompra: now,
									gastoCompraId: gastoCompra.gastoCompraId,
									tenantId,
								},
							});
						}

						// ── Flujo de pagos ──
						await handlePaymentInTransaction(tx, {
							formaPagoFinal: (formaPago || "PAGO_COMPLETO").toUpperCase(),
							cuentaIdParam,
							totalCost,
							monedaOriginal,
							montoOriginal,
							tasaCambio,
							montoConvertido,
							periodo,
							productoNombre: producto.nombre,
							userId: user.userId,
							gastoCompraId: gastoCompra.gastoCompraId,
							vendorId: producto.vendorId!,
							vendorNombre:
								producto.vendor?.nombre || "Proveedor no especificado",
							numeroFactura,
							now,
							compraProductoId: compraProducto?.compraProductoId,
							tenantId,
						});
					}

					return {
						producto: (updatedProducto as any ?? newProductInstance)!,
						gastoCompra,
						newProductInstance,
						compraProducto,
						workflowResult,
					};
				},
				{
					maxWait: 5000,
					timeout: 10000,
				},
			);

			revalidatePath("/busy/products");

			return {
				producto: result.producto,
				gastoCompra: result.gastoCompra,
				productInstance: result.newProductInstance,
				weightedAverages: {
					precioCosto:
						result.workflowResult.weightedAverages.costPrice.weightedAverage,
					precioVenta:
						result.workflowResult.weightedAverages.sellingPrice.weightedAverage,
				},
				restockDetails: {
					cantidadAnterior: producto.stock,
					cantidadNueva: result.producto.stock,
					cantidadAgregada: cantidad,
					costoTotal: result.gastoCompra.total,
					reason: result.workflowResult.reason,
				},
			};
		},
	),
);

// ─── Helpers para restock (no exportados) ──────────────────

/**
 * Parámetros para el flujo de pagos dentro de la transacción de restock.
 */
interface PaymentParams {
	formaPagoFinal: string;
	cuentaIdParam?: string;
	totalCost: number;
	monedaOriginal?: string;
	montoOriginal?: number;
	tasaCambio?: number;
	montoConvertido?: number;
	periodo: string;
	productoNombre: string;
	userId: string;
	gastoCompraId: string;
	vendorId: string;
	vendorNombre: string;
	numeroFactura?: string;
	now: Date;
	compraProductoId?: string;
	tenantId: string;
}

/**
 * @description Maneja el flujo de pagos (PAGO_COMPLETO o PAGO_PARCIAL)
 *   dentro de una transacción Prisma.
 *
 * - PAGO_COMPLETO: crea ReconciliacionGasto, decrementa saldo bancario.
 * - PAGO_PARCIAL: crea CuentaPorPagar.
 */
async function handlePaymentInTransaction(
	tx: any,
	params: PaymentParams,
): Promise<void> {
	const {
		formaPagoFinal,
		cuentaIdParam,
		totalCost,
		monedaOriginal,
		montoOriginal,
		tasaCambio,
		montoConvertido,
		periodo,
		productoNombre,
		userId,
		gastoCompraId,
		vendorId,
		vendorNombre,
		numeroFactura,
		now,
		compraProductoId,
		tenantId,
	} = params;

	const canRun =
		!!tx.tipoPago?.findFirst &&
		!!tx.cuentaBancaria?.findUnique &&
		!!tx.reconciliacionGasto?.create &&
		!!tx.cuentaBancaria?.update &&
		!!tx.cuentaPorPagar?.create;

	if (formaPagoFinal === "PAGO_COMPLETO" && canRun) {
		let cuentaId = cuentaIdParam;

		// Resolver cuenta por defecto si no se especificó
		if (!cuentaId) {
			const tipoPago = await tx.tipoPago.findFirst({
				where: { isActive: true, tenantId },
				orderBy: { createdAt: "asc" },
				select: { tipoId: true, cuentaDefecto: true },
			});

			if (tipoPago) {
				cuentaId = tipoPago.cuentaDefecto;
				if (!cuentaId) {
					const fallback = await tx.cuentaBancaria.findFirst({
						where: { isActive: true, tenantId },
						orderBy: { createdAt: "asc" },
						select: { cuentaId: true },
					});
					cuentaId = fallback?.cuentaId;
				}
			}
		}

		if (!cuentaId) {
			throw new ActionError(
				"No hay cuentas bancarias activas disponibles",
				"PAYMENT_ACCOUNT_MISSING",
			);
		}

		const cuentaBancaria = await tx.cuentaBancaria.findUnique({
			where: { cuentaId },
			select: { cuentaId: true, isActive: true },
		});

		if (!cuentaBancaria || !cuentaBancaria.isActive) {
			throw new ActionError(
				"La cuenta bancaria seleccionada no está activa",
				"INACTIVE_ACCOUNT",
			);
		}

		const tipoPagoData = await tx.tipoPago.findFirst({
			where: { isActive: true, tenantId },
			orderBy: { createdAt: "asc" },
			select: { tipoId: true },
		});

		const isForeignCurrency = monedaOriginal && monedaOriginal !== "CUP";

		const reconciliacionMonto = isForeignCurrency ? montoOriginal! : totalCost;
		const reconciliacionMoneda = isForeignCurrency ? monedaOriginal! : "CUP";
		const reconciliacionTasaCambio = isForeignCurrency
			? (tasaCambio ?? null)
			: null;
		const reconciliacionMontoConvertido = isForeignCurrency
			? (montoConvertido ?? null)
			: null;

		await tx.reconciliacionGasto.create({
			data: {
				tipoGasto: "compra",
				referenciaId: gastoCompraId,
				cuentaId,
				tipoPagoId: tipoPagoData?.tipoId ?? "",
				gastoCompraId,
				monto: reconciliacionMonto,
				moneda: reconciliacionMoneda,
				tasaCambio: reconciliacionTasaCambio,
				montoConvertido: reconciliacionMontoConvertido,
				descripcion: `Restock pagado - ${productoNombre}`,
				periodo,
				estado: "PAGADA",
				reconciliadoPor: userId || "system",
				tenantId,
			},
		});

		const saldoADescontar = isForeignCurrency
			? (montoConvertido ?? totalCost)
			: totalCost;

		await tx.cuentaBancaria.update({
			where: { cuentaId },
			data: { saldo: { decrement: saldoADescontar } },
		});
	} else if (formaPagoFinal === "PAGO_PARCIAL" && canRun) {
		const isForeignCurrency = monedaOriginal && monedaOriginal !== "CUP";

		const deudaMonto = isForeignCurrency ? montoOriginal! : totalCost;
		const deudaMoneda = isForeignCurrency ? monedaOriginal! : "CUP";

		const cuentaPorPagar = await tx.cuentaPorPagar.create({
			data: {
				numeroFactura: numeroFactura || `RESTOCK-${now.getTime()}`,
				tipo: "compra",
				gastoCompraId,
				proveedorId: vendorId,
				proveedorNombre: vendorNombre,
				montoDeuda: deudaMonto,
				montoPagado: 0,
				saldoPendiente: deudaMonto,
				moneda: deudaMoneda,
				fechaEmision: now,
				estado: "PENDIENTE",
				tenantId,
			},
		});

		// Vincular CompraProducto con CuentaPorPagar
		if (compraProductoId && tx.compraProducto?.update) {
			await tx.compraProducto.update({
				where: { compraProductoId },
				data: {
					cuentaPorPagarId: cuentaPorPagar.cuentaPorPagarId,
				},
			});
		}
	}
}
