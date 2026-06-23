"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import {
	requireTenant,
	requireManagerRole,
	requireFeature,
	validateTenantLimit,
} from "@/lib/services/tenant-scope";
import { withPeriodValidation } from "@/lib/services/with-period-validation";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import { executeProductInstanceCreationWorkflow } from "@/lib/restock-utils";
import { recordCostChange, CostChangeReason } from "@/lib/cost-history-utils";
import { syncOwnerAssets } from "@/lib/upload/cloudinary-admin";
import { PRODUCTO_SELECT, ProductoService } from "./services/producto-service";
import {
	productoSchema,
	productoUpdateSchema,
	stockUbicacionQuerySchema,
	restockSchema,
} from "./schemas";
import type {
	ProductoInput,
	ProductoUpdateInput,
	StockUbicacionQuery,
	RestockInput,
} from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import type {
	RestockHistoryQueryInput,
	RestockHistoryResponse,
	RestockHistoryItem,
} from "./types";
// ─── EAN-13: shared utilities ─────────────────────────────
import {
	resolveTaxonomySegments,
	generateProductCodeWithRetry,
	normalizeProveedorCodigo,
} from "@/lib/product-business-code";
import {
	FindNextAvailableSurtido,
	ValidateAssembledCode,
} from "@/lib/ean13-utils";

// ─── Server Actions ────────────────────────────────────────

/**
 * @description Lista todos los productos del tenant autenticado.
 */
export const getProductosAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		return ProductoService.list(tenantId);
	},
);

/**
 * @description Obtiene un producto por ID dentro del tenant autenticado.
 */
export const getProductoByIdAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		return ProductoService.getById({ tenantId, productId: id });
	},
);

/**
 * @description Crea un nuevo producto con validación Zod.
 * Cuando la empresa usa EAN-13, genera el código de negocio completo
 * (sección, específico, surtido, dígito de control) de forma automática.
 */
export const createProductoAction = withAction(
	async (input: ProductoInput, user: AuthenticatedUser) => {
		const parsed = productoSchema.parse(input);
		const tenantId = requireTenant(user);

		requireManagerRole(user, "crear productos");
		requireFeature(user, "productos", "gestión de productos");
		await validateTenantLimit(
			tenantId,
			"maxProductos",
			await prisma.producto.count({ where: { tenantId } }),
		);

		// ── Detectar si la empresa usa EAN-13 ──
		// ⚠️ MULTI-TENANT: MiEmpresa es 1:1 por tenant (id siempre vale 1,
		// tenantId es UNIQUE). Sin filtrar por tenantId, leemos el flag de
		// un tenant arbitrario, lo que rompe toda la lógica EAN-13.
		const miEmpresa = await prisma.miEmpresa.findUnique({
			where: { tenantId },
			select: { usaCodigoEan13: true },
		});
		const usaCodigoEan13 = miEmpresa?.usaCodigoEan13 ?? false;

		if (usaCodigoEan13) {
			// ── Resolver proveedor ──
			let proveedorCodigo: string;
			let resolvedVendorId: string | null = parsed.vendorId ?? null;

			if (parsed.vendorId) {
				const vendor = await prisma.vendor.findUnique({
					where: { vendorId: parsed.vendorId },
					select: {
						vendorId: true,
						vendorCode: true,
					},
				});

				if (!vendor) {
					throw new ActionError(
						"El proveedor seleccionado no existe",
						"VALIDATION_ERROR",
					);
				}

				if (vendor.vendorCode) {
					proveedorCodigo = normalizeProveedorCodigo(vendor.vendorCode);
				} else if (parsed.proveedorCodigo) {
					proveedorCodigo = normalizeProveedorCodigo(parsed.proveedorCodigo);
				} else {
					throw new ActionError(
						"El proveedor seleccionado no tiene código configurado para generar el EAN-13",
						"VALIDATION_ERROR",
					);
				}
			} else {
				if (!parsed.proveedorCodigo) {
					throw new ActionError(
						"Debe ingresar el código de proveedor (2 dígitos) para generar el EAN-13",
						"VALIDATION_ERROR",
					);
				}
				proveedorCodigo = normalizeProveedorCodigo(parsed.proveedorCodigo);
				resolvedVendorId = null;
			}

			// ── Validar categoría/subcategoría ──
			if (!parsed.categoriaId) {
				throw new ActionError(
					"La categoría es requerida para generar el código de negocio",
					"VALIDATION_ERROR",
				);
			}
			if (!parsed.subcategoriaId) {
				throw new ActionError(
					"La subcategoría es requerida para generar el código de negocio",
					"VALIDATION_ERROR",
				);
			}

			const [categoria, subcategoria] = await Promise.all([
				// ⚠️ MULTI-TENANT: filtrar por tenantId para que un usuario malicioso
				// no pueda referenciar categorías de otros tenants.
				prisma.categoria.findFirst({
					where: { tenantId, catId: parsed.categoriaId },
					select: { catId: true, nombre: true },
				}),
				prisma.categoria.findFirst({
					where: { tenantId, catId: parsed.subcategoriaId },
					select: { catId: true, nombre: true, parentId: true },
				}),
			]);

			if (!categoria) {
				throw new ActionError(
					"La categoría seleccionada no existe",
					"VALIDATION_ERROR",
				);
			}
			if (!subcategoria) {
				throw new ActionError(
					"La subcategoría seleccionada no existe",
					"VALIDATION_ERROR",
				);
			}
			if (subcategoria.parentId !== parsed.categoriaId) {
				throw new ActionError(
					"La subcategoría debe pertenecer a la categoría seleccionada",
					"VALIDATION_ERROR",
				);
			}

			const resolvedSegments = resolveTaxonomySegments(
				categoria.nombre,
				subcategoria.nombre,
			);

			// ── Generar código EAN-13 en transacción ──
			const resultado = await prisma.$transaction(async (tx) => {
				const surtido = await FindNextAvailableSurtido(
					tx,
					tenantId,
					proveedorCodigo,
				);

				const generatedCode = await generateProductCodeWithRetry(
					tx,
					{
						proveedorCodigo,
						idSeccionCodigo: resolvedSegments.idSeccionCodigo,
						especificoCodigo: resolvedSegments.especificoCodigo,
						surtidoCodigo: surtido,
					},
					3,
				);

				if (!ValidateAssembledCode(generatedCode.codigoNegocio)) {
					throw new ActionError(
						"El código EAN-13 generado no pasó validación",
						"VALIDATION_ERROR",
					);
				}

				const producto = await tx.producto.create({
					data: {
						nombre: parsed.nombre,
						descripcion: parsed.descripcion ?? null,
						precioCosto: parsed.precioCosto,
						precioVenta: parsed.precioVenta,
						stock: parsed.stock,
						stockMinimo: parsed.stockMinimo ?? 0,
						codigoInterno: parsed.codigoInterno ?? null,
						// EAN-13 fields
						codigoNegocio: generatedCode.codigoNegocio,
						proveedorCodigo: generatedCode.proveedorCodigo,
						idSeccionCodigo: generatedCode.idSeccionCodigo,
						especificoCodigo: generatedCode.especificoCodigo,
						surtidoCodigo: generatedCode.surtidoCodigo,
						dcCodigo: generatedCode.dcCodigo,
						categoriaId: parsed.categoriaId,
						subcategoriaId: parsed.subcategoriaId ?? null,
						unidadId: parsed.unidadId ?? null,
						vendorId: resolvedVendorId,
						almacenId: parsed.almacenId,
						puntoDeVentaId: parsed.puntoDeVentaId ?? null,
						fotos: parsed.fotos ?? [],
						tenantId,
						...(parsed.precios?.length
							? {
									precios: {
										create: parsed.precios.map((p) => ({
											listaPrecioId: p.listaPrecioId,
											precio: p.precio,
										})),
									},
								}
							: {}),
					},
					select: PRODUCTO_SELECT,
				});

				if (parsed.stock > 0) {
					await upsertStockUbicacion(tx, {
						productoId: producto.id,
						tipoUbicacion: "almacen",
						ubicacionId: parsed.almacenId,
						modo: "set",
						valor: parsed.stock,
					});

					if (parsed.puntoDeVentaId) {
						await upsertStockUbicacion(tx, {
							productoId: producto.id,
							tipoUbicacion: "punto_venta",
							ubicacionId: parsed.puntoDeVentaId,
							modo: "set",
							valor: parsed.stock,
						});
					}
				}

				return { producto, generatedCode };
			});

			// ── GastoCompra para stock inicial ──
			if (parsed.stock > 0 && resolvedVendorId) {
				const now = new Date();
				const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
				await prisma.gastoCompra.create({
					data: {
						tenantId,
						productoId: resultado.producto.id,
						vendorId: resolvedVendorId,
						cantidad: parsed.stock,
						precioUnitario: parsed.precioCosto,
						total: parsed.stock * parsed.precioCosto,
						fechaCompra: now,
						descripcion: `Compra inicial - ${parsed.nombre}`,
						periodo,
					},
				});
			}

			revalidatePath("/busy/products");
			if (parsed.photoAssets) {
				await syncOwnerAssets({
					tenantId,
					ownerType: "producto",
					ownerId: resultado.producto.id,
					slot: "photo",
					assets: parsed.photoAssets,
				});
			}
			return resultado.producto;
		}

		// ── Sin EAN-13: create simple ──
		const producto = await prisma.producto.create({
			data: {
				nombre: parsed.nombre,
				descripcion: parsed.descripcion ?? null,
				precioCosto: parsed.precioCosto,
				precioVenta: parsed.precioVenta,
				stock: parsed.stock,
				stockMinimo: parsed.stockMinimo ?? 0,
				codigoInterno: parsed.codigoInterno ?? null,
				proveedorCodigo: parsed.proveedorCodigo ?? null,
				categoriaId: parsed.categoriaId,
				subcategoriaId: parsed.subcategoriaId ?? null,
				unidadId: parsed.unidadId ?? null,
				vendorId: parsed.vendorId ?? null,
				almacenId: parsed.almacenId,
				puntoDeVentaId: parsed.puntoDeVentaId ?? null,
				fotos: parsed.fotos ?? [],
				tenantId,
				...(parsed.precios?.length
					? {
							precios: {
								create: parsed.precios.map((p) => ({
									listaPrecioId: p.listaPrecioId,
									precio: p.precio,
								})),
							},
						}
					: {}),
			},
			select: PRODUCTO_SELECT,
		});

		if (parsed.stock > 0) {
			await upsertStockUbicacion(prisma, {
				productoId: producto.id,
				tipoUbicacion: "almacen",
				ubicacionId: parsed.almacenId,
				modo: "set",
				valor: parsed.stock,
			});

			if (parsed.puntoDeVentaId) {
				await upsertStockUbicacion(prisma, {
					productoId: producto.id,
					tipoUbicacion: "punto_venta",
					ubicacionId: parsed.puntoDeVentaId,
					modo: "set",
					valor: parsed.stock,
				});
			}
		}

		if (parsed.photoAssets) {
			await syncOwnerAssets({
				tenantId,
				ownerType: "producto",
				ownerId: producto.id,
				slot: "photo",
				assets: parsed.photoAssets,
			});
		}

		revalidatePath("/busy/products");
		return producto;
	},
);

/**
 * @description Actualiza un producto existente.
 *
 * @throws ActionError si el producto no existe
 */
export const updateProductoAction = withAction(
	async (input: ProductoUpdateInput, user: AuthenticatedUser) => {
		requireManagerRole(user, "editar productos");
		const parsed = productoUpdateSchema.parse(input);
		const { id, ...updateData } = parsed;

		const tenantId = requireTenant(user);

		const existing = await prisma.producto.findUnique({
			where: { id },
			select: { id: true, tenantId: true, stock: true, almacenId: true },
		});

		if (!existing) {
			throw new ActionError("Producto no encontrado", "NOT_FOUND");
		}

		const oldStock = existing.stock;
		const oldAlmacenId = existing.almacenId;

		const producto = await prisma.$transaction(async (tx: any) => {
			// Upsert precios dentro de la misma transacción
			if (parsed.precios?.length) {
				await Promise.all(
					parsed.precios.map((p) =>
						tx.precioProducto.upsert({
							where: {
								listaPrecioId_productoId: {
									listaPrecioId: p.listaPrecioId,
									productoId: id,
								},
							},
							update: { precio: p.precio },
							create: {
								listaPrecioId: p.listaPrecioId,
								productoId: id,
								precio: p.precio,
							},
						}),
					),
				);
			}

			const updated = await tx.producto.update({
				where: { id },
				data: {
					...(updateData.nombre !== undefined && { nombre: updateData.nombre }),
					...(updateData.descripcion !== undefined && {
						descripcion: updateData.descripcion,
					}),
					...(updateData.precioCosto !== undefined && {
						precioCosto: updateData.precioCosto,
					}),
					...(updateData.precioVenta !== undefined && {
						precioVenta: updateData.precioVenta,
					}),
					...(updateData.stock !== undefined && { stock: updateData.stock }),
					...(updateData.stockMinimo !== undefined && {
						stockMinimo: updateData.stockMinimo,
					}),
					...(updateData.codigoInterno !== undefined && {
						codigoInterno: updateData.codigoInterno,
					}),
					...(updateData.proveedorCodigo !== undefined && {
						proveedorCodigo: updateData.proveedorCodigo,
					}),
					...(updateData.categoriaId !== undefined && {
						categoriaId: updateData.categoriaId,
					}),
					...(updateData.subcategoriaId !== undefined && {
						subcategoriaId: updateData.subcategoriaId,
					}),
					...(updateData.unidadId !== undefined && {
						unidadId: updateData.unidadId,
					}),
					...(updateData.vendorId !== undefined && {
						vendorId: updateData.vendorId,
					}),
					...(updateData.almacenId !== undefined && {
						almacenId: updateData.almacenId,
					}),
					...(updateData.puntoDeVentaId !== undefined && {
						puntoDeVentaId: updateData.puntoDeVentaId,
					}),
					...(updateData.fotos !== undefined && { fotos: updateData.fotos }),
				},
				select: PRODUCTO_SELECT,
			});

			// Sincronizar StockUbicacion si cambió stock o almacén
			const newStock = updateData.stock;
			const newAlmacenId = updateData.almacenId;
			const almacenCambio =
				newAlmacenId !== undefined && newAlmacenId !== oldAlmacenId;

			if (newStock !== undefined && almacenCambio) {
				// Caso combinado: stock + almacén cambiaron simultáneamente
				// Clear old almacén, set new stock en new almacén
				if (oldAlmacenId) {
					await upsertStockUbicacion(tx, {
						productoId: updated.id,
						tipoUbicacion: "almacen",
						ubicacionId: oldAlmacenId,
						modo: "set",
						valor: 0,
					});
				}
				if (newAlmacenId) {
					await upsertStockUbicacion(tx, {
						productoId: updated.id,
						tipoUbicacion: "almacen",
						ubicacionId: newAlmacenId,
						modo: "set",
						valor: newStock,
					});
				}
			} else if (newStock !== undefined) {
				// Solo cambió stock: set en la ubicación actual
				if (oldAlmacenId) {
					await upsertStockUbicacion(tx, {
						productoId: updated.id,
						tipoUbicacion: "almacen",
						ubicacionId: oldAlmacenId,
						modo: "set",
						valor: newStock,
					});
				}
			} else if (almacenCambio) {
				// Solo cambió almacén: mover stock
				if (oldStock > 0) {
					if (oldAlmacenId) {
						await upsertStockUbicacion(tx, {
							productoId: updated.id,
							tipoUbicacion: "almacen",
							ubicacionId: oldAlmacenId,
							modo: "increment",
							delta: -oldStock,
						});
					}
					if (newAlmacenId) {
						await upsertStockUbicacion(tx, {
							productoId: updated.id,
							tipoUbicacion: "almacen",
							ubicacionId: newAlmacenId,
							modo: "increment",
							delta: oldStock,
						});
					}
				}
			}

			return updated;
		});

		if (parsed.photoAssets) {
			await syncOwnerAssets({
				tenantId,
				ownerType: "producto",
				ownerId: producto.id,
				slot: "photo",
				assets: parsed.photoAssets,
			});
		}

		revalidatePath("/busy/products");
		return producto;
	},
);

/**
 * @description Elimina un producto por ID.
 *
 * @throws ActionError si el producto no existe
 */
export const deleteProductoAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireManagerRole(user, "eliminar productos");
		const tenantId = requireTenant(user);

		const existing = await prisma.producto.findUnique({
			where: { id },
			select: { id: true, tenantId: true },
		});

		if (!existing) {
			throw new ActionError("Producto no encontrado", "NOT_FOUND");
		}

		await prisma.producto.delete({ where: { id } });
		revalidatePath("/busy/products");

		return { id, eliminado: true };
	},
);
