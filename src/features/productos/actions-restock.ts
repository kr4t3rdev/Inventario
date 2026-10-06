"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { requireTenant, requirePermission, requireFeature } from "@/lib/services/tenant-scope";
import { withPeriodValidation } from "@/lib/services/with-period-validation";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { buildEventoEgreso } from '@/features/contabilidad-formal/lib/event-builders';
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { resolveAccountingAccountMovement } from '@/features/contabilidad/services/accounting-account-movement-valuation';
import { getRequiredTenantAccountingPolicy } from '@/features/contabilidad/services/tenant-accounting-policy-service';
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
			requireFeature(user, 'restock', 'realizar restock de productos');
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
			if (producto.tenantId !== tenantId) {
				throw new ActionError("Producto no encontrado", "NOT_FOUND");
			}

			// ── Idempotencia: si se provee número de factura, un reintento con la
			// misma factura se rechaza en lugar de duplicar el restock (gasto,
			// stock, asiento). Sin factura provista cada llamada genera su propio
			// número (RESTOCK-<timestamp>) y no colisiona.
			const numeroFacturaNormalizado = numeroFactura?.trim();
			if (numeroFacturaNormalizado) {
				const compraExistente = await prisma.gastoCompra.findFirst({
					where: { tenantId, numeroFactura: numeroFacturaNormalizado },
					select: { gastoCompraId: true },
				});
				if (compraExistente) {
					throw new ActionError(
						`Ya existe un restock registrado con la factura ${numeroFacturaNormalizado}`,
						"RESTOCK_DUPLICADO",
					);
				}
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
						const totalCost = new Prisma.Decimal(cantidad).mul(costPrice);

						// GastoCompra asociado a la nueva instancia
						gastoCompra = await tx.gastoCompra.create({
							data: {
								productoId: targetProducto.id,
								vendorId: targetProducto.vendorId!,
								cantidad,
								precioUnitario: costPrice,
								total: totalCost.toNumber(),
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
									total: totalCost.toNumber(),
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
						const totalCost = new Prisma.Decimal(cantidad).mul(costPrice);

						// GastoCompra
						gastoCompra = await tx.gastoCompra.create({
							data: {
								productoId: producto.id,
								vendorId: producto.vendorId!,
								cantidad,
								precioUnitario: costPrice,
								total: totalCost.toNumber(),
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
									total: totalCost.toNumber(),
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
	totalCost: Prisma.Decimal | number | string;
	monedaOriginal?: string;
	montoOriginal?: Prisma.Decimal | number | string;
	tasaCambio?: Prisma.Decimal | number | string;
	montoConvertido?: Prisma.Decimal | number | string;
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
		!!tx.cuentaBancaria?.findFirst &&
		!!tx.reconciliacionGasto?.create &&
		!!tx.cuentaBancaria?.updateMany &&
		!!tx.cuentaPorPagar?.create;

	const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
	const monedaFuncional = policy.functionalCurrencyCode.trim().toUpperCase();

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

		const cuentaBancaria = await tx.cuentaBancaria.findFirst({
			where: { cuentaId, tenantId, isActive: true },
			select: { cuentaId: true, isActive: true, moneda: true, tipoCuenta: true },
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

		const isForeignCurrency = !!monedaOriginal && monedaOriginal.trim().toUpperCase() !== monedaFuncional;

		const reconciliacionMonto = isForeignCurrency
			? new Prisma.Decimal(montoOriginal!)
			: new Prisma.Decimal(totalCost);
		const reconciliacionMoneda = isForeignCurrency ? monedaOriginal!.trim().toUpperCase() : monedaFuncional;
		if (isForeignCurrency && (montoOriginal == null || tasaCambio == null)) {
			throw new ActionError('Falta monto/tasa FX para el restock extranjero', 'FX_INSUFICIENTE');
		}
		const conversion = buildPersistedAccountingAmount(
			reconciliacionMonto,
			reconciliacionMoneda,
			tasaCambio,
			now,
			undefined,
			monedaFuncional,
		);
		if (!conversion.fxEvidence || conversion.montoConvertido == null) {
			throw new ActionError('Falta evidencia FX para el restock', 'FX_INSUFICIENTE');
		}
		if (montoConvertido != null) {
			const montoConvertidoEsperado = new Prisma.Decimal(montoConvertido);
			if (!montoConvertidoEsperado.eq(conversion.montoConvertido)) {
				throw new ActionError('El monto convertido no coincide con la tasa aplicada', 'FX_INCONSISTENTE');
			}
		}
		const reconciliacionTasaCambio = conversion.tasaCambio;
		const reconciliacionMontoConvertido = conversion.montoConvertido;

		const restockRec = await tx.reconciliacionGasto.create({
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
				...conversion.fxEvidence,
				descripcion: `Restock pagado - ${productoNombre}`,
				periodo,
				estado: "PAGADA",
				reconciliadoPor: userId,
				tenantId,
			},
		});

		// Capa de contabilidad formal (CTA-1): restock al contado consume inventario pagado.
		await postEvento(
			tx,
			{ tenantId, userId },
			buildEventoEgreso({
				tipo: 'COMPRA_CONTADO',
				reconciliacionId: restockRec.reconciliacionId,
				descripcion: `Restock pagado - ${productoNombre}`,
				tesoreria: {
					monto: restockRec.monto,
					moneda: restockRec.moneda,
					montoFuncional: restockRec.montoConvertido ?? undefined,
					monedaFuncionalCodigo: restockRec.functionalCurrency ?? 'CUP',
					tasaCambio: restockRec.tasaCambio,
					fxEvidenceFingerprint: restockRec.fxEvidenceFingerprint,
					referencia: gastoCompraId,
				},
			}),
		);

		const movimientoCuenta = resolveAccountingAccountMovement({
			tenderAmount: reconciliacionMonto,
			tenderCurrency: reconciliacionMoneda,
			functionalAmount: reconciliacionMontoConvertido,
			functionalCurrency: monedaFuncional,
			accountCurrency: cuentaBancaria.moneda,
		});
		const montoDebito = movimientoCuenta.amount.toNumber();
		// Débito atómico: la condición de saldo suficiente evita sobregiros
		// bajo concurrencia (dos restocks simultáneos no pueden vaciar la cuenta).
		const saldoActualizado = await tx.cuentaBancaria.updateMany({
			where: { cuentaId, tenantId, isActive: true, saldo: { gte: montoDebito } },
			data: { saldo: { decrement: montoDebito } },
		});
		if (saldoActualizado.count !== 1) {
			const cuentaVigente = await tx.cuentaBancaria.findFirst({
				where: { cuentaId, tenantId, isActive: true },
				select: { cuentaId: true },
			});
			if (!cuentaVigente) {
				throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
			}
			throw new ActionError(
				'Saldo insuficiente en la cuenta bancaria para completar el restock',
				'SALDO_INSUFICIENTE',
			);
		}
	} else if (formaPagoFinal === "PAGO_PARCIAL" && canRun) {
		const isForeignCurrency = !!monedaOriginal && monedaOriginal.trim().toUpperCase() !== monedaFuncional;

		const deudaMonto = isForeignCurrency ? new Prisma.Decimal(montoOriginal!) : new Prisma.Decimal(totalCost);
		const deudaMoneda = isForeignCurrency ? monedaOriginal!.trim().toUpperCase() : monedaFuncional;

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
