/**
 * @description Tests unitarios para Server Actions de compras de productos.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/inventory-cost-utils", () => ({
	calcularPrecioCostoCompra: vi.fn(),
}));
vi.mock("@/lib/services/pago-gastos-workflow", () => ({
	applyPagoGastoWorkflow: vi.fn(),
}));
vi.mock("@/lib/services/anticipos-workflow", () => ({
	applyAnticipoAllocations: vi.fn(),
}));
vi.mock("@/lib/services/stock-ubicacion-service", () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock("@/lib/services/stock-ubicacion-queries", () => ({
	getStockTotalProducto: vi.fn(),
}));
vi.mock("@/lib/cost-history-utils", () => ({
	recordCostChange: vi.fn(),
	CostChangeReason: { RESTOCK: "RESTOCK" },
}));
vi.mock("@/lib/services/anticipos-guards", () => ({
	hasUnrevertedAnticipoExecution: vi.fn(),
}));

const mockTx = {
	compraDocumento: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
	compraDocumentoItem: { create: vi.fn() },
	ordenCompra: { findFirst: vi.fn(), updateMany: vi.fn() },
	producto: { update: vi.fn(), findFirst: vi.fn() },
	gastoCompra: { create: vi.fn() },
	cuentaPorPagar: { create: vi.fn(), delete: vi.fn() },
	stockMoveLine: { upsert: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
	unidadConversion: { findFirst: vi.fn() },
	unidad: { findFirst: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
	prisma: {
		compraDocumento: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			count: vi.fn(),
		},
		vendor: { findFirst: vi.fn() },
		producto: { findFirst: vi.fn() },
		ordenCompra: { findFirst: vi.fn() },
		anticipoMovimiento: { findFirst: vi.fn() },
		cuentaPorPagar: { create: vi.fn(), delete: vi.fn() },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import { calcularPrecioCostoCompra } from "@/lib/inventory-cost-utils";
import { getStockTotalProducto } from "@/lib/services/stock-ubicacion-queries";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import {
	getComprasProductosAction,
	getCompraProductoByIdAction,
	createCompraProductoAction,
	updateCompraProductoAction,
	deleteCompraProductoAction,
} from "@/features/compras-productos/actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import type { CreateCompraProductoInput } from "@/features/compras-productos/schemas";
import { Prisma } from "@/generated/prisma";
import type { AnticipoMovimiento, CompraDocumento, Producto, Vendor } from "@/generated/prisma";

const mockUser: AuthenticatedUser = {
	userId: "user-1",
	name: "Test",
	email: "test@test.com",
	role: "admin",
	isActive: true,
	tenantId: "tenant-test",
	tenantRole: "manager",
};

const mockVendorRow: Vendor = {
	vendorId: "ven-1",
	tenantId: "tenant-test",
	nombre: "Proveedor",
	contacto: null,
	createdAt: new Date("2025-01-01"),
	updatedAt: new Date("2025-01-01"),
	contrato: null,
	cuentaCUP: null,
	cuentaUSD: null,
	direccion: null,
	logo: null,
	telefono: null,
	vendorCode: null,
};

const mockProductRow: Producto = {
	id: "prod-1",
	nombre: "Producto de prueba",
	tenantId: "tenant-test",
	descripcion: null,
	precioCosto: 500,
	precioVenta: 1000,
	stock: 10,
	categoriaId: "cat-1",
	unidadId: null,
	vendorId: null,
	createdAt: new Date("2025-01-01"),
	updatedAt: new Date("2025-01-01"),
	esCompuesto: false,
	almacenId: "alm-1",
	puntoDeVentaId: null,
	stockMinimo: 0,
	subcategoriaId: null,
	cantidadEnPack: null,
	productoPadreId: null,
	codigoInterno: null,
	codigoNegocio: null,
	proveedorCodigo: null,
	idSeccionCodigo: null,
	especificoCodigo: null,
	surtidoCodigo: null,
	dcCodigo: null,
	fotos: [],
};

const mockCompraDocumentoRow: CompraDocumento = {
	compraDocumentoId: "cd-1",
	tenantId: "tenant-test",
	proveedorId: "ven-1",
	numeroFactura: "",
	facturaUrl: "",
	formaPago: "PAGO_COMPLETO",
	moneda: "CUP",
	estado: "PAGADA",
	tipoOperacion: "REGULAR",
	descripcion: null,
	fechaCompra: new Date("2025-01-01"),
	total: 0,
	gastoCompraId: null,
	cuentaPorPagarId: null,
	ordenCompraId: null,
	deletedAt: null,
	claveIdempotencia: null,
	updatedById: null,
	createdAt: new Date("2025-01-01"),
	updatedAt: new Date("2025-01-01"),
};

const mockAnticipoMovimientoRow: AnticipoMovimiento = {
	movimientoId: "mov-1",
	anticipoId: "ant-1",
	tipoMovimiento: "APLICADO",
	contexto: "COMPRA_PRODUCTO",
	documentoDestinoId: "cd-1",
	reconciliacionVentaId: null,
	reconciliacionGastoId: null,
	monto: new Prisma.Decimal(1),
	moneda: "CUP",
	tasaAplicada: null,
	montoConvertido: null,
	saldoAntes: new Prisma.Decimal(1),
	saldoDespues: new Prisma.Decimal(0),
	usuarioId: "user-1",
	idempotencyKey: null,
	observaciones: null,
	createdAt: new Date("2025-01-01"),
};

/**
 * @description Mocks a vendor row using the current Prisma model contract.
 * @param {Partial<Vendor>} overrides - Vendor fields specific to the test.
 * @returns {void} No return value.
 */
function mockVendorResponse(overrides: Partial<Vendor> | null) {
	vi.mocked(prisma.vendor.findFirst).mockResolvedValue(
		overrides === null ? null : { ...mockVendorRow, ...overrides },
	);
}

/**
 * @description Mocks a product row using the current Prisma model contract.
 * @param {Partial<Producto>} overrides - Product fields specific to the test.
 * @returns {void} No return value.
 */
function mockProductResponse(overrides: Partial<Producto>) {
	vi.mocked(prisma.producto.findFirst).mockResolvedValue({ ...mockProductRow, ...overrides });
}

/**
 * @description Mocks a purchase row and optional included relations.
 * @param {Partial<CompraDocumento> & { cuentaPorPagar?: object | null; items?: Array<{ compraDocumentoItemId: string }> } | null} overrides - Purchase fixture overrides.
 * @returns {void} No return value.
 */
function mockCompraDocumentoResponse(
	overrides: (Partial<CompraDocumento> & {
		cuentaPorPagar?: { cuentaPorPagarId: string; montoDeuda: number; saldoPendiente: number; estado: string } | null;
		items?: Array<{ compraDocumentoItemId: string }>;
	}) | null,
) {
	vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue(
		overrides === null ? null : { ...mockCompraDocumentoRow, ...overrides },
	);
}

/**
 * @description Mocks a typed advance movement fixture.
 * @param {Partial<AnticipoMovimiento> | null} overrides - Movement fields or a missing row.
 * @returns {void} No return value.
 */
function mockAnticipoMovimientoResponse(overrides: Partial<AnticipoMovimiento> | null) {
	vi.mocked(prisma.anticipoMovimiento.findFirst).mockResolvedValue(
		overrides === null ? null : { ...mockAnticipoMovimientoRow, ...overrides },
	);
}

/**
 * @description Applies the documented schema defaults to purchase action fixtures.
 * @param {Pick<CreateCompraProductoInput, "proveedorId" | "formaPago" | "estado" | "items"> & Partial<CreateCompraProductoInput>} input - Purchase input fixture.
 * @returns {ReturnType<typeof createCompraProductoAction>} Typed action response.
 */
function createCompraProductoWithDefaults(
	input: Pick<CreateCompraProductoInput, "proveedorId" | "formaPago" | "estado" | "items"> &
		Partial<CreateCompraProductoInput>,
) {
	return createCompraProductoAction({
		...input,
		moneda: input.moneda ?? "CUP",
		numeroFactura: input.numeroFactura ?? "",
		facturaUrl: input.facturaUrl ?? "",
	});
}

describe("ComprasProductos Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getComprasProductosAction", () => {
		it("retorna lista paginada", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([]);
			vi.mocked(prisma.compraDocumento.count).mockResolvedValue(0);
			const result = await getComprasProductosAction({ page: 1, limit: 20 });
			expect(result.success).toBe(true);
		});
	});

	describe("getCompraProductoByIdAction", () => {
		it("retorna compra por ID", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockCompraDocumentoResponse({
				compraDocumentoId: "cd-1",
			} as any);
			const result = await getCompraProductoByIdAction("cd-1");
			expect(result.success).toBe(true);
		});
	});

	describe("createCompraProductoAction", () => {
		it("crea compra exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({
				vendorId: "ven-1",
				nombre: "Proveedor",
			});
			mockProductResponse({
				id: "prod-1",
				stock: 10,
				precioCosto: 500,
				almacenId: "alm-1",
				tenantId: "tenant-test",
			});
			mockTx.compraDocumento.create.mockResolvedValue({
				compraDocumentoId: "cd-1",
			});
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-1" });
			mockTx.compraDocumento.update.mockResolvedValue({} as any);
			vi.mocked(getStockTotalProducto).mockResolvedValue(12);
			vi.mocked(calcularPrecioCostoCompra).mockReturnValue({
				precioCostoNuevo: 450,
				metodoCosto: "PONDERADO",
			} as any);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				items: [{ productoId: "prod-1", precioCosto: 400, cantidad: 10 }],
			});

			expect(result.success).toBe(true);
			// El stock se consulta dentro de la transacción (tx), no con el cliente global.
			expect(getStockTotalProducto).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ productoId: "prod-1" }),
			);
			expect(mockTx.producto.update).toHaveBeenCalledWith({
				where: { id: "prod-1" },
				data: { precioCosto: 450 },
			});
			expect(mockTx.producto.update).toHaveBeenCalledTimes(1);
			expect(mockTx.unidad.findFirst).not.toHaveBeenCalled();
			expect(mockTx.unidadConversion.findFirst).not.toHaveBeenCalled();
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				delta: 10,
			}),
		);
		expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					eventoKey: expect.objectContaining({
						tipoOrigen: "COMPRA",
						origenId: "cd-1",
					}),
				},
				create: expect.objectContaining({
					tenantId: "tenant-test",
					productoId: "prod-1",
					cantidad: 10,
					costoUnitario: 400,
					secuencia: "ITEM-0",
				}),
				update: {},
			}),
		);
	});

		it("converts a direct purchase using the tenant conversion and persists source trace", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1", nombre: "Proveedor" });
			mockProductResponse({
				id: "prod-1", stock: 10, precioCosto: 500, almacenId: "alm-1", tenantId: "tenant-test",
				unidadId: "unit-each",
			});
		mockTx.producto.findFirst.mockResolvedValue({ ...mockProductRow, unidadId: "unit-each" });
		mockTx.unidad.findFirst
				.mockResolvedValueOnce({ unidadId: "unit-box", tenantId: "tenant-test", nombre: "Caja", simbolo: "cj", dimension: "COUNT" } as any)
				.mockResolvedValueOnce({ unidadId: "unit-each", tenantId: "tenant-test", nombre: "Unidad", simbolo: "u", dimension: "COUNT" } as any);
			mockTx.unidadConversion.findFirst.mockResolvedValue({
				tenantId: "tenant-test", productoId: "prod-1", baseUnidadId: "unit-each", unidadId: "unit-box",
				factorAStock: new Prisma.Decimal("12"),
			} as any);
			mockTx.compraDocumento.create.mockResolvedValue({ compraDocumentoId: "cd-unit" });
			mockTx.compraDocumento.findUnique.mockResolvedValue({ compraDocumentoId: "cd-unit" } as any);
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-unit" });
			mockTx.compraDocumento.update.mockResolvedValue({} as any);
			vi.mocked(getStockTotalProducto).mockResolvedValue(10);
			vi.mocked(calcularPrecioCostoCompra).mockReturnValue({ precioCostoNuevo: 500, metodoCosto: "PONDERADO" } as any);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1", formaPago: "PAGO_COMPLETO", estado: "PAGADA",
				items: [{ productoId: "prod-1", unidadId: "unit-box", precioCosto: 6000, cantidad: 2, factorAStock: "999" } as any],
			});

			expect(result.success).toBe(true);
			expect(mockTx.compraDocumento.create).toHaveBeenCalledWith(expect.objectContaining({
				data: expect.objectContaining({ total: 12000 }),
			}));
			expect(mockTx.compraDocumentoItem.create).toHaveBeenCalledWith(expect.objectContaining({
				data: expect.objectContaining({
					cantidad: 24, precioUnitario: 500, totalLinea: 12000,
					unidadOrigenId: "unit-box", unidadOrigenNombre: "Caja", unidadOrigenSimbolo: "cj",
					cantidadOrigen: 2, precioUnitarioOrigen: 6000, factorAStockAplicado: "12.00000000",
					unidadBaseIdSnapshot: "unit-each", unidadBaseNombreSnapshot: "Unidad", unidadBaseSimboloSnapshot: "u",
				}),
			}));
			expect(upsertStockUbicacion).toHaveBeenCalledWith(mockTx, expect.objectContaining({ delta: 24 }));
			expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(expect.objectContaining({
				create: expect.objectContaining({ cantidad: 24, costoUnitario: 500, costoTotal: 12000 }),
			}));
			expect(mockTx.gastoCompra.create).toHaveBeenCalledWith(expect.objectContaining({
				data: expect.objectContaining({ cantidad: 24, precioUnitario: 500, total: 12000 }),
			}));
			expect(mockTx.unidadConversion.findFirst).toHaveBeenCalledWith({
				where: { tenantId: "tenant-test", productoId: "prod-1", baseUnidadId: "unit-each", unidadId: "unit-box" },
			});
		});

		it("requires the existing units plan feature only when a source unit is selected", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser, role: "regularUser", planFeatures: { unidades: false },
			});
			mockVendorResponse({ vendorId: "ven-1" });

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1", formaPago: "PAGO_COMPLETO", estado: "PAGADA",
				items: [{ productoId: "prod-1", unidadId: "unit-box", precioCosto: 6000, cantidad: 2 }],
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.code).toBe("FEATURE_NOT_AVAILABLE");
			expect(prisma.producto.findFirst).not.toHaveBeenCalled();
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

		it("normalizes Prisma Decimal scientific notation before exact minimum-scale conversion", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1", nombre: "Proveedor" });
			mockProductResponse({ id: "prod-1", unidadId: "unit-each", tenantId: "tenant-test" });
			mockTx.producto.findFirst.mockResolvedValue({ ...mockProductRow, unidadId: "unit-each" });
			mockTx.unidad.findFirst
				.mockResolvedValueOnce({ unidadId: "unit-pack", tenantId: "tenant-test", nombre: "Paquete", simbolo: "paq", dimension: "COUNT" } as any)
				.mockResolvedValueOnce({ unidadId: "unit-each", tenantId: "tenant-test", nombre: "Unidad", simbolo: "u", dimension: "COUNT" } as any);
			mockTx.unidadConversion.findFirst.mockResolvedValue({
				tenantId: "tenant-test", productoId: "prod-1", baseUnidadId: "unit-each", unidadId: "unit-pack",
				factorAStock: new Prisma.Decimal("0.00000001"),
			} as any);
			mockTx.compraDocumento.create.mockResolvedValue({ compraDocumentoId: "cd-min-factor" });
			mockTx.compraDocumento.findUnique.mockResolvedValue({ compraDocumentoId: "cd-min-factor" } as any);
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-min-factor" });
			mockTx.compraDocumento.update.mockResolvedValue({} as any);
			vi.mocked(getStockTotalProducto).mockResolvedValue(0);
			vi.mocked(calcularPrecioCostoCompra).mockReturnValue({ precioCostoNuevo: 100000000, metodoCosto: "PONDERADO" } as any);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1", formaPago: "PAGO_COMPLETO", estado: "PAGADA",
				items: [{ productoId: "prod-1", unidadId: "unit-pack", precioCosto: 1, cantidad: 100000000 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.compraDocumentoItem.create).toHaveBeenCalledWith(expect.objectContaining({
				data: expect.objectContaining({
					cantidad: 1,
					precioUnitario: 100000000,
					totalLinea: 100000000,
					factorAStockAplicado: "0.00000001",
				}),
			}));
		});

		it("rejects a cross-tenant unit before writing purchase or inventory rows", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1", nombre: "Proveedor" });
			mockProductResponse({ id: "prod-1", unidadId: "unit-each", tenantId: "tenant-test" });
			mockTx.producto.findFirst.mockResolvedValue({ ...mockProductRow, unidadId: "unit-each" });
			mockTx.unidad.findFirst
				.mockResolvedValueOnce({ unidadId: "unit-box", tenantId: "tenant-other", nombre: "Caja", simbolo: "cj", dimension: "COUNT" } as any)
				.mockResolvedValueOnce({ unidadId: "unit-each", tenantId: "tenant-test", nombre: "Unidad", simbolo: "u", dimension: "COUNT" } as any);
			mockTx.unidadConversion.findFirst.mockResolvedValue({
				tenantId: "tenant-test", productoId: "prod-1", baseUnidadId: "unit-each", unidadId: "unit-box",
				factorAStock: new Prisma.Decimal("12"),
			} as any);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1", formaPago: "PAGO_COMPLETO", estado: "PAGADA",
				items: [{ productoId: "prod-1", unidadId: "unit-box", precioCosto: 6000, cantidad: 2 }],
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.code).toBe("VALIDATION_ERROR");
			expect(mockTx.compraDocumento.create).not.toHaveBeenCalled();
			expect(mockTx.compraDocumentoItem.create).not.toHaveBeenCalled();
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
			expect(mockTx.stockMoveLine.upsert).not.toHaveBeenCalled();
		});

		it("rejects a fractional converted unit cost before any writes", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1", nombre: "Proveedor" });
			mockProductResponse({ id: "prod-1", unidadId: "unit-each", tenantId: "tenant-test" });
			mockTx.producto.findFirst.mockResolvedValue({ ...mockProductRow, unidadId: "unit-each" });
			mockTx.unidad.findFirst
				.mockResolvedValueOnce({ unidadId: "unit-pack", tenantId: "tenant-test", nombre: "Paquete", simbolo: "paq", dimension: "COUNT" } as any)
				.mockResolvedValueOnce({ unidadId: "unit-each", tenantId: "tenant-test", nombre: "Unidad", simbolo: "u", dimension: "COUNT" } as any);
			mockTx.unidadConversion.findFirst.mockResolvedValue({
				tenantId: "tenant-test", productoId: "prod-1", baseUnidadId: "unit-each", unidadId: "unit-pack",
				factorAStock: new Prisma.Decimal("3"),
			} as any);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1", formaPago: "PAGO_COMPLETO", estado: "PAGADA",
				items: [{ productoId: "prod-1", unidadId: "unit-pack", precioCosto: 100, cantidad: 3 }],
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.message).toContain("no se puede representar exactamente");
			expect(mockTx.compraDocumento.create).not.toHaveBeenCalled();
			expect(mockTx.compraDocumentoItem.create).not.toHaveBeenCalled();
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
			expect(mockTx.stockMoveLine.upsert).not.toHaveBeenCalled();
		});

		it("rejects an inexact aggregate expense unit cost before purchase writes", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1", nombre: "Proveedor" });
			mockProductResponse({ id: "prod-1", unidadId: "unit-each", tenantId: "tenant-test" });
			mockTx.producto.findFirst.mockResolvedValue({ ...mockProductRow, unidadId: "unit-each" });
			mockTx.unidad.findFirst
				.mockResolvedValueOnce({ unidadId: "unit-each", tenantId: "tenant-test", nombre: "Unidad", simbolo: "u", dimension: "COUNT" } as any)
				.mockResolvedValueOnce({ unidadId: "unit-box", tenantId: "tenant-test", nombre: "Caja", simbolo: "cj", dimension: "COUNT" } as any);
			mockTx.unidadConversion.findFirst.mockResolvedValue({
				tenantId: "tenant-test", productoId: "prod-1", baseUnidadId: "unit-each", unidadId: "unit-box",
				factorAStock: new Prisma.Decimal("1"),
			} as any);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1", formaPago: "PAGO_COMPLETO", estado: "PAGADA",
				items: [
					{ productoId: "prod-1", unidadId: "unit-each", precioCosto: 1, cantidad: 1 },
					{ productoId: "prod-1", unidadId: "unit-box", precioCosto: 2, cantidad: 1 },
				],
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.message).toContain("costo promedio");
			expect(mockTx.compraDocumento.create).not.toHaveBeenCalled();
			expect(mockTx.compraDocumentoItem.create).not.toHaveBeenCalled();
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
			expect(mockTx.stockMoveLine.upsert).not.toHaveBeenCalled();
		});

		it("rechaza si proveedor no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse(null);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-noexiste",
				formaPago: "PAGO_PARCIAL",
				estado: "PENDIENTE",
				items: [{ productoId: "prod-1", precioCosto: 400, cantidad: 5 }],
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.message).toContain("Proveedor no encontrado");
		});

		it("factura una recepción sin duplicar stock ni kardex", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({
				vendorId: "ven-1",
				nombre: "Proveedor",
			});
			// La OC y las facturas previas se leen DENTRO de la transacción (TOCTOU).
			mockTx.ordenCompra.updateMany.mockResolvedValue({ count: 1 });
			mockTx.ordenCompra.findFirst.mockResolvedValue({
				id: "oc-1",
				proveedorId: "ven-1",
				estado: "RECIBIDA",
				items: [{ productoId: "prod-1", precioUnitario: 500, recepciones: [{ cantidad: 10 }] }],
			} as any);
			mockTx.compraDocumento.findMany.mockResolvedValue([]);
			mockProductResponse({
				id: "prod-1",
				stock: 10,
				precioCosto: 500,
				almacenId: "alm-1",
				tenantId: "tenant-test",
			});
			mockTx.compraDocumento.create.mockResolvedValue({ compraDocumentoId: "cd-oc-1" });
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-oc-1" });
			mockTx.compraDocumento.update.mockResolvedValue({} as any);
			vi.mocked(getStockTotalProducto).mockResolvedValue(10);
			vi.mocked(calcularPrecioCostoCompra).mockReturnValue({
				precioCostoNuevo: 500,
				metodoCosto: "PONDERADO",
			} as any);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				ordenCompraId: "oc-1",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				items: [{ productoId: "prod-1", precioCosto: 500, cantidad: 10 }],
			});

			expect(result.success).toBe(true);
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
			expect(mockTx.stockMoveLine.upsert).not.toHaveBeenCalled();
			// La orden quedó bloqueada a nivel de fila dentro de la transacción.
			expect(mockTx.ordenCompra.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ id: "oc-1", tenantId: "tenant-test" }),
				}),
			);
		});

		it("rechaza facturar cantidades ya facturadas de la misma orden", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1" });
			mockTx.ordenCompra.updateMany.mockResolvedValue({ count: 1 });
			mockTx.ordenCompra.findFirst.mockResolvedValue({
				id: "oc-1",
				proveedorId: "ven-1",
				estado: "RECIBIDA",
				items: [{ productoId: "prod-1", precioUnitario: 500, recepciones: [{ cantidad: 10 }] }],
			} as any);
			mockTx.compraDocumento.findMany.mockResolvedValue([
				{ items: [{ productoId: "prod-1", cantidad: 10 }] },
			] as any);
			mockProductResponse({
				id: "prod-1", precioCosto: 500, almacenId: "alm-1", tenantId: "tenant-test",
			});

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				ordenCompraId: "oc-1",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				items: [{ productoId: "prod-1", precioCosto: 500, cantidad: 1 }],
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.code).toBe("FACTURA_EXCEDE_RECEPCION");
		});

		it("agrega líneas repetidas del mismo producto contra lo pendiente de facturar", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1" });
			mockTx.ordenCompra.updateMany.mockResolvedValue({ count: 1 });
			mockTx.ordenCompra.findFirst.mockResolvedValue({
				id: "oc-1",
				proveedorId: "ven-1",
				estado: "PARCIAL",
				items: [{ productoId: "prod-1", precioUnitario: 500, recepciones: [{ cantidad: 10 }] }],
			} as any);
			mockTx.compraDocumento.findMany.mockResolvedValue([]);
			mockProductResponse({
				id: "prod-1", precioCosto: 500, almacenId: "alm-1", tenantId: "tenant-test",
			});

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				ordenCompraId: "oc-1",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				items: [
					{ productoId: "prod-1", precioCosto: 500, cantidad: 8 },
					{ productoId: "prod-1", precioCosto: 500, cantidad: 8 },
				],
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.code).toBe("FACTURA_EXCEDE_RECEPCION");
		});

		it("valoriza la factura vinculada solo sobre el stock restante, sin doble entrada", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1" });
			mockTx.ordenCompra.updateMany.mockResolvedValue({ count: 1 });
			// La recepción dejó 10 unidades a costo 50 (precioUnitario de la línea OC).
			mockTx.ordenCompra.findFirst.mockResolvedValue({
				id: "oc-1",
				proveedorId: "ven-1",
				estado: "RECIBIDA",
				items: [{ productoId: "prod-1", precioUnitario: 50, recepciones: [{ cantidad: 10 }] }],
			} as any);
			mockTx.compraDocumento.findMany.mockResolvedValue([]);
			mockProductResponse({
				id: "prod-1", precioCosto: 50, almacenId: "alm-1", tenantId: "tenant-test",
			});
			mockTx.compraDocumento.create.mockResolvedValue({ compraDocumentoId: "cd-oc-2" });
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-2" });
			mockTx.compraDocumento.update.mockResolvedValue({} as any);
			vi.mocked(getStockTotalProducto).mockResolvedValue(10);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				ordenCompraId: "oc-1",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				items: [{ productoId: "prod-1", precioCosto: 100, cantidad: 10 }],
			});

			expect(result.success).toBe(true);
			// CPP = 50 + (100-50)·min(10,10)/10 = 100; no debe contarse como segunda entrada.
			expect(mockTx.producto.update).toHaveBeenCalledWith({
				where: { id: "prod-1" },
				data: { precioCosto: 100 },
			});
			expect(calcularPrecioCostoCompra).not.toHaveBeenCalled();
		});

		it("acota el ajuste de CPP a las unidades que quedan en stock (sin explosión)", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1" });
			mockTx.ordenCompra.updateMany.mockResolvedValue({ count: 1 });
			// OC de 100 unidades recibidas a costo 10.
			mockTx.ordenCompra.findFirst.mockResolvedValue({
				id: "oc-9",
				proveedorId: "ven-1",
				estado: "RECIBIDA",
				items: [{ productoId: "prod-1", precioUnitario: 10, recepciones: [{ cantidad: 100 }] }],
			} as any);
			mockTx.compraDocumento.findMany.mockResolvedValue([]);
			mockProductResponse({
				id: "prod-1", precioCosto: 8, almacenId: "alm-1", tenantId: "tenant-test",
			});
			mockTx.compraDocumento.create.mockResolvedValue({ compraDocumentoId: "cd-expl" });
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-x" });
			mockTx.compraDocumento.update.mockResolvedValue({} as any);
			// Se vendieron 95 antes de facturar: solo quedan 5.
			vi.mocked(getStockTotalProducto).mockResolvedValue(5);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				ordenCompraId: "oc-9",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				items: [{ productoId: "prod-1", precioCosto: 12, cantidad: 100 }],
			});

			expect(result.success).toBe(true);
			// Sin acotar: 8 + (12-10)·100/5 = 48 (explosión). Acotado: 8 + (12-10)·5/5 = 10.
			expect(mockTx.producto.update).toHaveBeenCalledWith({
				where: { id: "prod-1" },
				data: { precioCosto: 10 },
			});
		});

		it("ancla el ajuste de CPP al precio de la línea de OC, no al CPP actual", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1" });
			mockTx.ordenCompra.updateMany.mockResolvedValue({ count: 1 });
			mockTx.ordenCompra.findFirst.mockResolvedValue({
				id: "oc-10",
				proveedorId: "ven-1",
				estado: "RECIBIDA",
				items: [{ productoId: "prod-1", precioUnitario: 10, recepciones: [{ cantidad: 10 }] }],
			} as any);
			mockTx.compraDocumento.findMany.mockResolvedValue([]);
			// Otra compra directa movió el CPP a 50 mientras la OC esperaba factura.
			mockProductResponse({
				id: "prod-1", precioCosto: 50, almacenId: "alm-1", tenantId: "tenant-test",
			});
			mockTx.compraDocumento.create.mockResolvedValue({ compraDocumentoId: "cd-anchor" });
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-y" });
			mockTx.compraDocumento.update.mockResolvedValue({} as any);
			vi.mocked(getStockTotalProducto).mockResolvedValue(10);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				ordenCompraId: "oc-10",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				items: [{ productoId: "prod-1", precioCosto: 10, cantidad: 10 }],
			});

			expect(result.success).toBe(true);
			// Factura coincide con la OC: sin ajuste. El CPP actual (50) no se toca.
			expect(mockTx.producto.update).toHaveBeenCalledWith({
				where: { id: "prod-1" },
				data: { precioCosto: 50 },
			});
		});

		it("agrega el ajuste de CPP por producto cuando hay líneas duplicadas", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1" });
			mockTx.ordenCompra.updateMany.mockResolvedValue({ count: 1 });
			mockTx.ordenCompra.findFirst.mockResolvedValue({
				id: "oc-11",
				proveedorId: "ven-1",
				estado: "RECIBIDA",
				items: [{ productoId: "prod-1", precioUnitario: 10, recepciones: [{ cantidad: 10 }] }],
			} as any);
			mockTx.compraDocumento.findMany.mockResolvedValue([]);
			mockProductResponse({
				id: "prod-1", precioCosto: 10, almacenId: "alm-1", tenantId: "tenant-test",
			});
			mockTx.compraDocumento.create.mockResolvedValue({ compraDocumentoId: "cd-dup" });
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-z" });
			mockTx.compraDocumento.update.mockResolvedValue({} as any);
			vi.mocked(getStockTotalProducto).mockResolvedValue(10);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				ordenCompraId: "oc-11",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				items: [
					{ productoId: "prod-1", precioCosto: 100, cantidad: 4 },
					{ productoId: "prod-1", precioCosto: 130, cantidad: 6 },
				],
			});

			expect(result.success).toBe(true);
			// Factura ponderada = (4·100 + 6·130)/10 = 118. CPP = 10 + (118-10)·10/10 = 118.
			// Un solo update por producto: la segunda línea no pisa a la primera.
			expect(mockTx.producto.update).toHaveBeenCalledTimes(1);
			expect(mockTx.producto.update).toHaveBeenCalledWith({
				where: { id: "prod-1" },
				data: { precioCosto: 118 },
			});
		});

		it("devuelve la factura existente ante un reintento con la misma clave (C1)", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			const existente = {
				compraDocumentoId: "cd-prev",
				tenantId: "tenant-test",
				claveIdempotencia: "fact-key-1",
			};
			mockCompraDocumentoResponse(existente);

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				claveIdempotencia: "fact-key-1",
				items: [{ productoId: "prod-1", precioCosto: 400, cantidad: 3 }],
			});

			expect(result.success).toBe(true);
			expect(expectActionSuccess(result).data.compraDocumentoId).toBe("cd-prev");
			expect(prisma.$transaction).not.toHaveBeenCalled();
			expect(mockTx.compraDocumento.create).not.toHaveBeenCalled();
		});

		it("resuelve una carrera P2002 devolviendo la factura ganadora (C1)", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({ vendorId: "ven-1", nombre: "P" });
			mockProductResponse({
				id: "prod-1", precioCosto: 100, almacenId: "alm-1", tenantId: "tenant-test",
			});
			// Pre-chequeo: no existe. Tras la carrera: ya existe la del ganador.
			vi.mocked(prisma.compraDocumento.findFirst)
				.mockResolvedValueOnce(null)
				.mockResolvedValue({
					...mockCompraDocumentoRow,
					compraDocumentoId: "cd-ganador",
					claveIdempotencia: "race-key-1",
				});
			vi.mocked(getStockTotalProducto).mockResolvedValue(0);
			vi.mocked(calcularPrecioCostoCompra).mockReturnValue({ precioCostoNuevo: 100, metodoCosto: "PONDERADO" } as any);
			mockTx.compraDocumento.create.mockRejectedValue({ code: "P2002" });

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				claveIdempotencia: "race-key-1",
				items: [{ productoId: "prod-1", precioCosto: 100, cantidad: 2 }],
			});

			expect(result.success).toBe(true);
			expect(expectActionSuccess(result).data.compraDocumentoId).toBe("cd-ganador");
		});
	});

	describe("updateCompraProductoAction", () => {
		it("usa transacción cuando cambia formaPago", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockTx.compraDocumento.findFirst.mockResolvedValue({
				compraDocumentoId: "cd-1",
				tenantId: "tenant-test",
				proveedorId: "prov-1",
				numeroFactura: "F-001",
				total: 1000,
				gastoCompraId: "gc-1",
				formaPago: "PAGO_COMPLETO",
				cuentaPorPagarId: null,
				cuentaPorPagar: null,
			});
			mockTx.cuentaPorPagar.create.mockResolvedValue({
				cuentaPorPagarId: "cxp-new",
			});
			mockTx.compraDocumento.update.mockResolvedValue({} as any);

			const result = await updateCompraProductoAction({
				compraDocumentoId: "cd-1",
				formaPago: "PAGO_PARCIAL",
			});

			expect(result.success).toBe(true);
			expect(prisma.$transaction).toHaveBeenCalled();
			expect(mockTx.cuentaPorPagar.create).toHaveBeenCalled();
		});

		it("actualiza campos de cabecera sin impacto contable", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockCompraDocumentoResponse({
				compraDocumentoId: "cd-1",
				formaPago: "PAGO_COMPLETO",
				cuentaPorPagar: null,
			});
			vi.mocked(prisma.compraDocumento.update).mockResolvedValue({} as any);

			const result = await updateCompraProductoAction({
				compraDocumentoId: "cd-1",
				estado: "PAGADA",
			});
			expect(result.success).toBe(true);
		});

		it("PAGO_PARCIAL → PAGO_COMPLETO elimina cuentaPorPagar", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockTx.compraDocumento.findFirst.mockResolvedValue({
				compraDocumentoId: "cd-1",
				tenantId: "tenant-test",
				formaPago: "PAGO_PARCIAL",
				cuentaPorPagarId: "cxp-1",
				cuentaPorPagar: {
					cuentaPorPagarId: "cxp-1",
					montoDeuda: 1000,
					saldoPendiente: 1000,
					estado: "PENDIENTE",
				},
			});
			mockTx.cuentaPorPagar.delete.mockResolvedValue({} as any);
			mockTx.compraDocumento.update.mockResolvedValue({} as any);

			const result = await updateCompraProductoAction({
				compraDocumentoId: "cd-1",
				formaPago: "PAGO_COMPLETO",
			});

			expect(result.success).toBe(true);
			expect(prisma.$transaction).toHaveBeenCalled();
			expect(mockTx.cuentaPorPagar.delete).toHaveBeenCalledWith({
				where: { cuentaPorPagarId: "cxp-1" },
			});
		});

		it("PAGO_COMPLETO → PAGO_PARCIAL crea cuentaPorPagar", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockTx.compraDocumento.findFirst.mockResolvedValue({
				compraDocumentoId: "cd-1",
				tenantId: "tenant-test",
				proveedorId: "prov-1",
				numeroFactura: "F-001",
				total: 1000,
				gastoCompraId: "gc-1",
				formaPago: "PAGO_COMPLETO",
				cuentaPorPagarId: null,
				cuentaPorPagar: null,
			});
			mockTx.cuentaPorPagar.create.mockResolvedValue({
				cuentaPorPagarId: "cxp-new",
			});
			mockTx.compraDocumento.update.mockResolvedValue({} as any);

			const result = await updateCompraProductoAction({
				compraDocumentoId: "cd-1",
				formaPago: "PAGO_PARCIAL",
			});

			expect(result.success).toBe(true);
			expect(prisma.$transaction).toHaveBeenCalled();
			expect(mockTx.cuentaPorPagar.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						montoDeuda: 1000,
						saldoPendiente: 1000,
						estado: "PENDIENTE",
						tipo: "compra",
					}),
				}),
			);
		});

		it("rechaza cambiar a ANTICIPO_PAGO (validado por schema Zod)", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockCompraDocumentoResponse({
				compraDocumentoId: "cd-1",
				formaPago: "PAGO_COMPLETO",
				cuentaPorPagar: null,
			});

			const result = await updateCompraProductoAction({
				compraDocumentoId: "cd-1",
				formaPago: "ANTICIPO_PAGO" as any,
			});

			expect(result.success).toBe(false);
			expect(prisma.compraDocumento.update).not.toHaveBeenCalled();
		});

		it("rechaza cambiar desde ANTICIPO_PAGO", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockTx.compraDocumento.findFirst.mockResolvedValue({
				compraDocumentoId: "cd-1",
				tenantId: "tenant-test",
				formaPago: "ANTICIPO_PAGO",
				cuentaPorPagar: null,
			});

			const result = await updateCompraProductoAction({
				compraDocumentoId: "cd-1",
				formaPago: "PAGO_COMPLETO",
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.message).toContain("ANTICIPO_PAGO");
		});

		it("rechaza PAGO_PARCIAL → PAGO_COMPLETO con pagos parciales", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockTx.compraDocumento.findFirst.mockResolvedValue({
				compraDocumentoId: "cd-1",
				tenantId: "tenant-test",
				formaPago: "PAGO_PARCIAL",
				cuentaPorPagarId: "cxp-1",
				cuentaPorPagar: {
					cuentaPorPagarId: "cxp-1",
					montoDeuda: 1000,
					saldoPendiente: 500,
					estado: "PENDIENTE",
				},
			});

			const result = await updateCompraProductoAction({
				compraDocumentoId: "cd-1",
				formaPago: "PAGO_COMPLETO",
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.message).toContain("pagos parciales");
		});
	});

	describe("deleteCompraProductoAction", () => {
		it("rechaza borrar compra que ya impactó inventario", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockCompraDocumentoResponse({
				compraDocumentoId: "cd-1",
				gastoCompraId: null,
				cuentaPorPagarId: null,
				items: [{ compraDocumentoItemId: "item-1" }],
			});

			const result = await deleteCompraProductoAction("cd-1");
			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.message).toContain("impactó inventario");
			expect(prisma.compraDocumento.update).not.toHaveBeenCalled();
		});

		it("permite soft-delete solo si la compra no tiene items ni impacto", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockCompraDocumentoResponse({
				compraDocumentoId: "cd-1",
				gastoCompraId: null,
				cuentaPorPagarId: null,
				items: [],
			});
			mockAnticipoMovimientoResponse(null);
			vi.mocked(prisma.compraDocumento.update).mockResolvedValue({} as any);

			const result = await deleteCompraProductoAction("cd-1");
			expect(result.success).toBe(true);
			expect(prisma.compraDocumento.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { compraDocumentoId: "cd-1", tenantId: "tenant-test", deletedAt: null },
				}),
			);
			expect(prisma.anticipoMovimiento.findFirst).toHaveBeenCalledWith({
				where: {
					documentoDestinoId: "cd-1",
					contexto: "COMPRA_PRODUCTO",
					anticipo: { tenantId: "tenant-test" },
				},
			});
			expect(prisma.compraDocumento.updateMany).toHaveBeenCalledWith({
				where: { compraDocumentoId: "cd-1", tenantId: "tenant-test", deletedAt: null },
				data: { deletedAt: expect.any(Date) },
			});
		});

		it("rechaza borrar compra con gastoCompraId", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockCompraDocumentoResponse({
				compraDocumentoId: "cd-1",
				gastoCompraId: "gc-1",
				cuentaPorPagarId: null,
			});

			const result = await deleteCompraProductoAction("cd-1");
			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.message).toContain("gasto contable");
			expect(prisma.compraDocumento.update).not.toHaveBeenCalled();
		});

		it("rechaza borrar compra con cuentaPorPagarId", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockCompraDocumentoResponse({
				compraDocumentoId: "cd-1",
				gastoCompraId: null,
				cuentaPorPagarId: "cxp-1",
			});

			const result = await deleteCompraProductoAction("cd-1");
			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.message).toContain("cuenta por pagar");
			expect(prisma.compraDocumento.update).not.toHaveBeenCalled();
		});

		it("rechaza borrar compra con anticipo aplicado", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockCompraDocumentoResponse({
				compraDocumentoId: "cd-1",
				gastoCompraId: null,
				cuentaPorPagarId: null,
			});
			mockAnticipoMovimientoResponse({
				movimientoId: "mov-1",
			});

			const result = await deleteCompraProductoAction("cd-1");
			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error.message).toContain("anticipo");
			expect(prisma.compraDocumento.update).not.toHaveBeenCalled();
		});
	});

	describe("moneda de la compra (B-02.1)", () => {
		const setupCreateMocks = () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockVendorResponse({
				vendorId: "ven-1",
				nombre: "Proveedor",
			} as never);
			mockProductResponse({
				id: "prod-1", stock: 10, precioCosto: 500, almacenId: "alm-1", tenantId: "tenant-test",
			} as never);
			mockTx.compraDocumento.create.mockResolvedValue({ compraDocumentoId: "cd-1" } as never);
			mockTx.compraDocumento.findUnique.mockResolvedValue({ compraDocumentoId: "cd-1" } as never);
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-1" } as never);
			mockTx.compraDocumento.update.mockResolvedValue({} as never);
			vi.mocked(getStockTotalProducto).mockResolvedValue(12);
			vi.mocked(calcularPrecioCostoCompra).mockReturnValue({
				precioCostoNuevo: 450, metodoCosto: "PONDERADO",
			} as never);
		};

		it("propaga la moneda elegida al documento y a la CxP", async () => {
			setupCreateMocks();

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				formaPago: "PAGO_PARCIAL",
				estado: "PENDIENTE",
				moneda: "USD",
				items: [{ productoId: "prod-1", precioCosto: 400, cantidad: 10 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.compraDocumento.create.mock.calls[0][0].data.moneda).toBe("USD");
			// La deuda nace en la moneda de la compra, no en CUP fijo.
			expect(mockTx.cuentaPorPagar.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ moneda: "USD" }),
				}),
			);
		});

		it("usa CUP por defecto cuando no se indica moneda", async () => {
			setupCreateMocks();

			const result = await createCompraProductoWithDefaults({
				proveedorId: "ven-1",
				formaPago: "PAGO_PARCIAL",
				estado: "PENDIENTE",
				items: [{ productoId: "prod-1", precioCosto: 400, cantidad: 10 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.compraDocumento.create.mock.calls[0][0].data.moneda).toBe("CUP");
			expect(mockTx.cuentaPorPagar.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ moneda: "CUP" }),
				}),
			);
		});

		it("al cambiar a PAGO_PARCIAL la nueva CxP hereda la moneda del documento", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockTx.compraDocumento.findFirst.mockResolvedValue({
				compraDocumentoId: "cd-1",
				tenantId: "tenant-test",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				numeroFactura: "F-1",
				total: 4000,
				moneda: "MLC",
				proveedorId: "ven-1",
				gastoCompraId: "gc-1",
				cuentaPorPagarId: null,
				cuentaPorPagar: null,
			} as never);
			mockTx.cuentaPorPagar.create.mockResolvedValue({ cuentaPorPagarId: "cxp-1" } as never);
			mockTx.compraDocumento.update.mockResolvedValue({} as never);

			const result = await updateCompraProductoAction({
				compraDocumentoId: "cd-1",
				formaPago: "PAGO_PARCIAL",
				estado: "PENDIENTE",
			});

			expect(result.success).toBe(true);
			expect(mockTx.cuentaPorPagar.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ moneda: "MLC" }),
				}),
			);
		});
	});

	describe("auth requerido", () => {
		it("retorna AUTH_REQUIRED", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);
			const result = await getComprasProductosAction();
			expect(result.success).toBe(false);
		});
	});
});
