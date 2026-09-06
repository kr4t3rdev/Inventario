/**
 * @description Tests unitarios para Server Actions de transferencias.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notificaciones-utils", () => ({
	notificarTransferencia: vi.fn(),
}));
vi.mock("@/lib/services/stock-ubicacion-service", () => ({
	upsertStockUbicacion: vi.fn(),
}));

const mockTx = {
	transferencia: {
		create: vi.fn(),
		update: vi.fn(),
		updateMany: vi.fn(),
		findUnique: vi.fn(),
		count: vi.fn(),
	},
	producto: { update: vi.fn() },
	stockMoveLine: {
		upsert: vi.fn(),
		findMany: vi.fn().mockResolvedValue([]),
		count: vi.fn(),
		aggregate: vi.fn(),
	},
};

vi.mock("@/lib/prisma", () => ({
	prisma: {
		transferencia: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			count: vi.fn(),
			aggregate: vi.fn(),
		},
		producto: { findUnique: vi.fn() },
		stockUbicacion: { findUnique: vi.fn() },
		almacen: { findUnique: vi.fn(), findFirst: vi.fn() },
		puntoDeVenta: { findUnique: vi.fn(), findFirst: vi.fn() },
		ventaItem: { aggregate: vi.fn() },
		venta: { aggregate: vi.fn() },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { ActionError } from "@/lib/server-actions";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import { prisma } from "@/lib/prisma";
import {
	getTransferenciasAction,
	getTransferenciaByIdAction,
	createTransferenciaAction,
	updateTransferenciaAction,
	deleteTransferenciaAction,
	completarTransferenciaAction,
} from "@/features/transferencias/actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

const mockUser: AuthenticatedUser = {
	userId: "user-1",
	name: "Test",
	email: "test@test.com",
	role: "admin",
	isActive: true,
	tenantId: "tenant-test",
	tenantRole: "admin",
};

function mockCurrentTransfer(overrides: Record<string, unknown> = {}) {
	mockTx.transferencia.findUnique.mockResolvedValueOnce({
		transferenciaId: "tr-1",
		tenantId: "tenant-test",
		deletedAt: null,
		estado: "PENDIENTE",
		productoId: "prod-1",
		cantidad: 5,
		origenId: "alm-1",
		destinoId: "alm-2",
		puntoDeVentaOrigenId: null,
		puntoDeVentaDestinoId: null,
		...overrides,
	} as any);
}

describe("Transferencias Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(upsertStockUbicacion).mockReset();
		mockTx.transferencia.updateMany.mockResolvedValue({ count: 1 });
	});

	describe("getTransferenciasAction", () => {
		it("retorna lista paginada", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findMany).mockResolvedValue([]);
			vi.mocked(prisma.transferencia.count).mockResolvedValue(0);

			const result = await getTransferenciasAction({ page: 1, limit: 10 });

			expect(result.success).toBe(true);
			expect(result.data!.pagination.total).toBe(0);
			expect(prisma.transferencia.count).toHaveBeenCalledWith({
				where: { tenantId: "tenant-test", deletedAt: null },
			});
		});
	});

	describe("getTransferenciaByIdAction", () => {
		it("retorna transferencia por ID", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
			} as any);
			const result = await getTransferenciaByIdAction("tr-1");
			expect(result.success).toBe(true);
		});

		it("retorna NOT_FOUND si no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue(null);
			const result = await getTransferenciaByIdAction("tr-noexiste");
			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("NOT_FOUND");
		});
	});

	describe("createTransferenciaAction", () => {
		it("crea transferencia exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.producto.findUnique).mockResolvedValue({
				id: "prod-1",
				nombre: "Test",
				stock: 100,
				precioCosto: 1000,
				tenantId: "tenant-test",
			});
			vi.mocked(prisma.stockUbicacion.findUnique).mockResolvedValue({
				cantidadDisponible: 100,
			} as any);
			vi.mocked(prisma.almacen.findFirst).mockResolvedValue({
				almacenId: "alm-1",
				nombre: "Almacén 1",
			});
			vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
				pvId: "pv-1",
				nombre: "PV 1",
			});
			mockTx.transferencia.count.mockResolvedValue(0);
			mockTx.transferencia.create.mockResolvedValue({
				transferenciaId: "tr-1",
			});
			mockTx.stockMoveLine.upsert.mockResolvedValue({
				id: "move-1",
			});

			const result = await createTransferenciaAction({
				productos: [{ productoId: "prod-1", cantidad: 5 }],
				tipoOrigen: "almacen",
				origenId: "alm-1",
				tipoDestino: "punto_venta",
				destinoId: "pv-1",
			});

			expect(result.success).toBe(true);
			expect(mockTx.transferencia.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					tenantId: "tenant-test",
					productoId: "prod-1",
					cantidad: 5,
					origenId: "alm-1",
					puntoDeVentaDestinoId: "pv-1",
				}),
			});
			expect(mockTx.producto.update).not.toHaveBeenCalled();
			expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledTimes(2);
			expect(mockTx.stockMoveLine.upsert).toHaveBeenNthCalledWith(1,
				expect.objectContaining({
					where: { eventoKey: expect.objectContaining({ secuencia: "SALIDA-0" }) },
					create: expect.objectContaining({
						tipoOrigen: "TRANSFERENCIA",
						origenId: "tr-1",
						cantidad: -5,
						ubicacionId: "alm-1",
					}),
					update: {},
				}),
			);
			expect(mockTx.stockMoveLine.upsert).toHaveBeenNthCalledWith(2,
				expect.objectContaining({
					where: { eventoKey: expect.objectContaining({ secuencia: "ENTRADA-0" }) },
					create: expect.objectContaining({ cantidad: 5, ubicacionId: "pv-1" }),
				}),
			);
		});

		it("rechaza origen=destino", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			const result = await createTransferenciaAction({
				productos: [{ productoId: "prod-1", cantidad: 1 }],
				tipoOrigen: "almacen",
				origenId: "alm-1",
				tipoDestino: "almacen",
				destinoId: "alm-1",
			});
			expect(result.success).toBe(false);
		});

		it("rechaza stock insuficiente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.producto.findUnique).mockResolvedValue({
				id: "prod-1",
				nombre: "Test",
				stock: 2,
				precioCosto: 1000,
				tenantId: "tenant-test",
			});
			vi.mocked(prisma.stockUbicacion.findUnique).mockResolvedValue({
				cantidadDisponible: 2,
			} as any);
			vi.mocked(prisma.almacen.findFirst).mockResolvedValue({
				almacenId: "alm-1",
				nombre: "Almacén 1",
			});
			vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
				pvId: "pv-1",
				nombre: "PV 1",
			});

			const result = await createTransferenciaAction({
				productos: [{ productoId: "prod-1", cantidad: 5 }],
				tipoOrigen: "almacen",
				origenId: "alm-1",
				tipoDestino: "punto_venta",
				destinoId: "pv-1",
			});

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("STOCK_INSUFICIENTE");
		});

		it("(RETIRE LEGACY) valida origen almacén con StockUbicacion y no con producto.stock", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.producto.findUnique).mockResolvedValue({
				id: "prod-1",
				nombre: "Test",
				stock: 0,
				almacenId: "alm-1",
				precioCosto: 1000,
				tenantId: "tenant-test",
			} as any);
			vi.mocked(prisma.stockUbicacion.findUnique).mockResolvedValue({
				cantidadDisponible: 8,
			} as any);
			vi.mocked(prisma.almacen.findFirst).mockResolvedValue({
				almacenId: "alm-1",
				nombre: "Almacén 1",
			});
			vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
				pvId: "pv-1",
				nombre: "PV 1",
			});
			mockTx.transferencia.count.mockResolvedValue(0);
			mockTx.transferencia.create.mockResolvedValue({
				transferenciaId: "tr-1",
			});

			const result = await createTransferenciaAction({
				productos: [{ productoId: "prod-1", cantidad: 5 }],
				tipoOrigen: "almacen",
				origenId: "alm-1",
				tipoDestino: "punto_venta",
				destinoId: "pv-1",
			});

			expect(result.success).toBe(true);
			expect(prisma.stockUbicacion.findUnique).toHaveBeenCalledWith({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: "prod-1",
						tipoUbicacion: "almacen",
						ubicacionId: "alm-1",
					},
				},
				select: { cantidadDisponible: true },
			});
		});
	});

	describe("completarTransferenciaAction", () => {
		it("completa transferencia y mueve stock en StockUbicacion", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "APROBADA",
				cantidad: 5,
				origenId: "alm-1",
				destinoId: null,
				productoId: "prod-1",
				puntoDeVentaOrigenId: null,
				puntoDeVentaDestinoId: "pv-2",
				tenantId: "tenant-test",
				deletedAt: null,
				producto: {
					id: "prod-1",
					nombre: "Test",
					stock: 100,
					precioCosto: 1000,
					tenantId: "tenant-test",
				} as any,
			} as any);

			const result = await completarTransferenciaAction({
				transferenciaId: "tr-1",
			});

			expect(result.success).toBe(true);
			expect(mockTx.producto.update).not.toHaveBeenCalled();

			// Verifica que upsertStockUbicacion se llamó para descontar del origen
			const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);
			expect(upsertStockUbicacion).toHaveBeenCalledWith(
				mockTx,
				expect.objectContaining({
					productoId: "prod-1",
					tipoUbicacion: "almacen",
					ubicacionId: "alm-1",
					modo: "increment",
					delta: -5,
				}),
			);

			// Verifica que upsertStockUbicacion se llamó para sumar al destino
			expect(upsertStockUbicacion).toHaveBeenCalledWith(
				mockTx,
				expect.objectContaining({
					productoId: "prod-1",
					tipoUbicacion: "punto_venta",
					ubicacionId: "pv-2",
					modo: "increment",
					delta: 5,
				}),
			);
		});

		it("protege completar contra una carrera con eliminación y no mueve stock", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "APROBADA",
				cantidad: 5,
				origenId: "alm-1",
				destinoId: "alm-2",
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: null,
			} as any);
			mockTx.transferencia.updateMany.mockResolvedValueOnce({ count: 0 });
			mockTx.transferencia.findUnique.mockResolvedValueOnce({
				transferenciaId: "tr-1",
				tenantId: "tenant-test",
				deletedAt: new Date(),
				estado: "CANCELADA",
			} as any);

			const result = await completarTransferenciaAction({
				transferenciaId: "tr-1",
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("CONFLICT");
		const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
		});
	});

	describe("updateTransferenciaAction", () => {
		it("actualiza cantidad y ajusta StockUbicacion", async () => {
			/**
			 * Fase 3: updateTransferenciaAction debe revertir el movimiento
			 * anterior sobre StockUbicacion y aplicar el nuevo.
			 */
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				cantidad: 3,
				estado: "COMPLETADA",
				origenId: "alm-1",
				destinoId: null,
				productoId: "prod-1",
				puntoDeVentaOrigenId: null,
				puntoDeVentaDestinoId: "pv-2",
				tenantId: "tenant-test",
				deletedAt: null,
			} as any);
			mockTx.transferencia.update.mockResolvedValue({
				transferenciaId: "tr-1",
				cantidad: 5,
			});

			const result = await updateTransferenciaAction({
				transferenciaId: "tr-1",
				productoId: "prod-1",
				cantidad: 5,
				tipoOrigen: "almacen",
				origenId: "alm-1",
				tipoDestino: "punto_venta",
				destinoId: "pv-2",
			});

			expect(result.success).toBe(true);

			const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);

			// Fase 3: ahora hace revert+apply (4 llamadas) en vez de delta neto (2 llamadas)
			// 1. Revertir old origen (almacén): devolver lo que salió
			expect(upsertStockUbicacion).toHaveBeenCalledWith(
				mockTx,
				expect.objectContaining({
					productoId: "prod-1",
					tipoUbicacion: "almacen",
					ubicacionId: "alm-1",
					delta: 3,
				}),
			);
			// 2. Aplicar nuevo origen (almacén): sacar nueva cantidad
			expect(upsertStockUbicacion).toHaveBeenCalledWith(
				mockTx,
				expect.objectContaining({
					productoId: "prod-1",
					tipoUbicacion: "almacen",
					ubicacionId: "alm-1",
					delta: -5,
				}),
			);
			// 3. Revertir old destino (PV): quitar lo que llegó
			expect(upsertStockUbicacion).toHaveBeenCalledWith(
				mockTx,
				expect.objectContaining({
					productoId: "prod-1",
					tipoUbicacion: "punto_venta",
					ubicacionId: "pv-2",
					delta: -3,
				}),
			);
			// 4. Aplicar nuevo destino (PV): poner nueva cantidad
			expect(upsertStockUbicacion).toHaveBeenCalledWith(
				mockTx,
				expect.objectContaining({
					productoId: "prod-1",
					tipoUbicacion: "punto_venta",
					ubicacionId: "pv-2",
					delta: 5,
				}),
			);

			expect(mockTx.producto.update).not.toHaveBeenCalled();
		});

		it("actualiza transferencia PENDIENTE sin tocar stock", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				cantidad: 3,
				estado: "PENDIENTE",
				origenId: "alm-1",
				destinoId: null,
				productoId: "prod-1",
				puntoDeVentaOrigenId: null,
				puntoDeVentaDestinoId: "pv-2",
				tenantId: "tenant-test",
				deletedAt: null,
			} as any);
			mockTx.transferencia.update.mockResolvedValue({
				transferenciaId: "tr-1",
				cantidad: 5,
			});
			mockTx.transferencia.findUnique.mockResolvedValue({
				transferenciaId: "tr-1",
				cantidad: 5,
			});

			const result = await updateTransferenciaAction({
				transferenciaId: "tr-1",
				productoId: "prod-1",
				cantidad: 5,
				tipoOrigen: "almacen",
				origenId: "alm-1",
				tipoDestino: "punto_venta",
				destinoId: "pv-2",
			});

			expect(result.success).toBe(true);
			const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
		});
	});

	it("no-op: retorna Sin cambios si origen, destino y cantidad son iguales", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
			transferenciaId: "tr-1",
			cantidad: 5,
			estado: "COMPLETADA",
			origenId: "alm-1",
			destinoId: null,
			productoId: "prod-1",
			puntoDeVentaOrigenId: null,
			puntoDeVentaDestinoId: "pv-2",
			tenantId: "tenant-test",
			deletedAt: null,
		} as any);
		// findUnique se llama en el early-return de no-op
		vi.mocked(prisma.transferencia.findUnique).mockResolvedValue({
			transferenciaId: "tr-1",
			cantidad: 5,
		} as any);

		const result = await updateTransferenciaAction({
			transferenciaId: "tr-1",
			productoId: "prod-1",
			cantidad: 5,
			tipoOrigen: "almacen",
			origenId: "alm-1",
			tipoDestino: "punto_venta",
			destinoId: "pv-2",
		});

		expect(result.success).toBe(true);
		expect(result.data?.message).toBe("Sin cambios");
	});

	it("cambio de destino sin cambio de cantidad sincroniza StockUbicacion", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		// Old: PV-X, New: PV-Y, misma cantidad
		vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
			transferenciaId: "tr-1",
			cantidad: 5,
			estado: "COMPLETADA",
			origenId: null,
			destinoId: null,
			productoId: "prod-1",
			puntoDeVentaOrigenId: "pv-x",
			puntoDeVentaDestinoId: "pv-y",
			tenantId: "tenant-test",
			deletedAt: null,
		} as any);
		mockTx.transferencia.update.mockResolvedValue({
			transferenciaId: "tr-1",
			cantidad: 5,
		});

		const result = await updateTransferenciaAction({
			transferenciaId: "tr-1",
			productoId: "prod-1",
			cantidad: 5,
			tipoOrigen: "punto_venta",
			origenId: "pv-x",
			tipoDestino: "punto_venta",
			destinoId: "pv-z",
		});

		expect(result.success).toBe(true);

		const { upsertStockUbicacion } = await import(
			"@/lib/services/stock-ubicacion-service"
		);

		// Solo destino cambió (PV-Y → PV-Z)
		// Revertir old destino (PV-Y: -5)
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				tipoUbicacion: "punto_venta",
				ubicacionId: "pv-y",
				delta: -5,
			}),
		);
		// Aplicar new destino (PV-Z: +5)
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				tipoUbicacion: "punto_venta",
				ubicacionId: "pv-z",
				delta: 5,
			}),
		);
		// Origen no cambió, no se revierte/aplica
		expect(upsertStockUbicacion).toHaveBeenCalledTimes(2);
	});

	it("cambio de tipo origen (almacén→PV) revierte y aplica correctamente", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
			transferenciaId: "tr-1",
			cantidad: 3,
			estado: "COMPLETADA",
			origenId: "alm-1",
			destinoId: null,
			productoId: "prod-1",
			puntoDeVentaOrigenId: null,
			puntoDeVentaDestinoId: "pv-2",
			tenantId: "tenant-test",
			deletedAt: null,
		} as any);
		mockTx.transferencia.update.mockResolvedValue({
			transferenciaId: "tr-1",
			cantidad: 3,
		});

		const result = await updateTransferenciaAction({
			transferenciaId: "tr-1",
			productoId: "prod-1",
			cantidad: 3,
			tipoOrigen: "punto_venta",
			origenId: "pv-nuevo",
			tipoDestino: "punto_venta",
			destinoId: "pv-2",
		});

		expect(result.success).toBe(true);

		const { upsertStockUbicacion } = await import(
			"@/lib/services/stock-ubicacion-service"
		);

		// Origen cambió de almacén a PV: revert old (alm-1: +3), apply new (PV-nuevo: -3)
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				delta: 3,
			}),
		);
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				tipoUbicacion: "punto_venta",
				ubicacionId: "pv-nuevo",
				delta: -3,
			}),
		);
		// Destino no cambió (PV-2), igual se revierte/aplica porque cantidad no cambió
		// (cantidadCambio = false, pero destinoCambio = false — se salta todas)
		// Esperamos: 2 de origen + 2 de destino (revert+apply al mismo destino)
		// Destino: misma ubicación, misma cantidad → no debería hacer nada
		// Solo origen cambió → 2 llamadas para origen, 0 para destino
		expect(upsertStockUbicacion).toHaveBeenCalledTimes(2);
	});

	it("cambio de productoId revierte StockUbicacion del producto anterior", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		// Old: prod-A desde almacén a PV, New: prod-B misma ruta
		vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
			transferenciaId: "tr-1",
			productoId: "prod-A",
			cantidad: 5,
			estado: "COMPLETADA",
			origenId: "alm-1",
			destinoId: null,
			puntoDeVentaOrigenId: null,
			puntoDeVentaDestinoId: "pv-2",
			tenantId: "tenant-test",
			deletedAt: null,
		} as any);
		mockTx.transferencia.update.mockResolvedValue({
			transferenciaId: "tr-1",
			cantidad: 5,
		});

		const result = await updateTransferenciaAction({
			transferenciaId: "tr-1",
			productoId: "prod-B",
			cantidad: 5,
			tipoOrigen: "almacen",
			origenId: "alm-1",
			tipoDestino: "punto_venta",
			destinoId: "pv-2",
		});

		expect(result.success).toBe(true);

		const { upsertStockUbicacion } = await import(
			"@/lib/services/stock-ubicacion-service"
		);

		// Revierte prod-A: origen alm-1 +5, destino pv-2 -5
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				productoId: "prod-A",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				delta: 5,
			}),
		);
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				productoId: "prod-A",
				tipoUbicacion: "punto_venta",
				ubicacionId: "pv-2",
				delta: -5,
			}),
		);
		// Aplica prod-B: origen alm-1 -5, destino pv-2 +5
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				productoId: "prod-B",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				delta: -5,
			}),
		);
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				productoId: "prod-B",
				tipoUbicacion: "punto_venta",
				ubicacionId: "pv-2",
				delta: 5,
			}),
		);

		expect(mockTx.producto.update).not.toHaveBeenCalled();
	});

	describe("deleteTransferenciaAction", () => {
		it("trata una transferencia ya eliminada como éxito idempotente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "CANCELADA",
				cantidad: 5,
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: new Date("2026-01-01T00:00:00.000Z"),
			} as any);

			const result = await deleteTransferenciaAction("tr-1");

			expect(result.success).toBe(true);
			expect(result.data?.message).toBe("Transferencia ya cancelada");
			expect(mockTx.transferencia.updateMany).not.toHaveBeenCalled();
			const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
		});

		it("mantiene el alcance por tenant al reclamar la eliminación", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "PENDIENTE",
				cantidad: 5,
				origenId: "alm-1",
				destinoId: "alm-2",
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: null,
			} as any);
			mockCurrentTransfer({ estado: "PENDIENTE" });

			const result = await deleteTransferenciaAction("tr-1");

			expect(result.success).toBe(true);
			expect(mockTx.transferencia.updateMany).toHaveBeenCalledWith({
				where: {
					transferenciaId: "tr-1",
					tenantId: "tenant-test",
					deletedAt: null,
					estado: "PENDIENTE",
				},
				data: { estado: "CANCELADA", deletedAt: expect.any(Date) },
			});
		});

		it("oculta una transferencia legacy CANCELADA que aún no tiene deletedAt", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "CANCELADA",
				cantidad: 5,
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: null,
			} as any);

			const result = await deleteTransferenciaAction("tr-1");

			expect(result.success).toBe(true);
			expect(mockTx.transferencia.updateMany).toHaveBeenCalledWith({
				where: {
					transferenciaId: "tr-1",
					tenantId: "tenant-test",
					deletedAt: null,
					estado: "CANCELADA",
				},
				data: { deletedAt: expect.any(Date) },
			});
		const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
		});

		it("tolera que otra solicitud haya reclamado primero la transferencia", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "COMPLETADA",
				cantidad: 5,
				origenId: "alm-1",
				destinoId: "alm-2",
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: null,
			} as any);
			mockCurrentTransfer({ estado: "COMPLETADA" });
			mockTx.transferencia.updateMany.mockResolvedValueOnce({ count: 0 });
			mockTx.transferencia.findUnique.mockResolvedValueOnce({
				transferenciaId: "tr-1",
				tenantId: "tenant-test",
				deletedAt: new Date(),
				estado: "CANCELADA",
			} as any);

			const result = await deleteTransferenciaAction("tr-1");

			expect(result.success).toBe(true);
			expect(result.data?.message).toBe("Transferencia ya cancelada");
			const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
		});

		it("rechaza la cancelación si otra solicitud completó la transferencia", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "PENDIENTE",
				cantidad: 5,
				origenId: "alm-1",
				destinoId: "alm-2",
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: null,
			} as any);
			mockCurrentTransfer({ estado: "PENDIENTE" });
			mockTx.transferencia.updateMany.mockResolvedValueOnce({ count: 0 });
			mockTx.transferencia.findUnique.mockResolvedValueOnce({
				transferenciaId: "tr-1",
				tenantId: "tenant-test",
				deletedAt: null,
				estado: "COMPLETADA",
			} as any);

			const result = await deleteTransferenciaAction("tr-1");

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("CONFLICT");
		});

		it("no cancela si el destino ya consumió todo el stock transferido", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "COMPLETADA",
				cantidad: 5,
				origenId: "alm-1",
				destinoId: "alm-2",
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: null,
			} as any);
			mockCurrentTransfer({ estado: "COMPLETADA" });
			const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);
			vi.mocked(upsertStockUbicacion).mockImplementation(
				async (_tx, opts: any) => {
					if (opts.delta < 0) {
						throw new ActionError(
							"Stock insuficiente en almacén alm-2",
							"STOCK_INSUFICIENTE",
						);
					}
				},
			);

			const result = await deleteTransferenciaAction("tr-1");

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("STOCK_INSUFICIENTE");
			expect(mockTx.transferencia.updateMany).toHaveBeenCalledTimes(1);
		});
		it("cancela transferencia exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "COMPLETADA",
				cantidad: 5,
				origenId: "alm-1",
				destinoId: null,
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: null,
				producto: { unidad: { simbolo: "u" }, nombre: "Test" } as any,
				origen: { nombre: "Almacén 1" } as any,
				destino: null,
				puntoDeVentaOrigen: null,
				puntoDeVentaDestino: null,
			});
			mockCurrentTransfer({ estado: "COMPLETADA", destinoId: null });

			const result = await deleteTransferenciaAction("tr-1");
			expect(result.success).toBe(true);
			expect(mockTx.producto.update).not.toHaveBeenCalled();
		});

		it("cancela transferencia PENDIENTE sin revertir stock", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "PENDIENTE",
				cantidad: 5,
				origenId: "alm-1",
				destinoId: "alm-2",
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: null,
				producto: { unidad: { simbolo: "u" }, nombre: "Test" } as any,
				origen: { nombre: "Almacén 1" } as any,
				destino: { nombre: "Almacén 2" } as any,
				puntoDeVentaOrigen: null,
				puntoDeVentaDestino: null,
			});
			mockCurrentTransfer({ estado: "PENDIENTE" });

			const result = await deleteTransferenciaAction("tr-1");
			expect(result.success).toBe(true);

			const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);
			expect(upsertStockUbicacion).not.toHaveBeenCalled();
		});

		it("(FASE 3) revierte StockUbicacion al cancelar", async () => {
			/**
			 * Fase 3: deleteTransferenciaAction debe revertir el movimiento
			 * sobre StockUbicacion.
			 */
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
				transferenciaId: "tr-1",
				estado: "COMPLETADA",
				cantidad: 5,
				origenId: "alm-1",
				destinoId: "alm-2",
				productoId: "prod-1",
				tenantId: "tenant-test",
				deletedAt: null,
				producto: { unidad: { simbolo: "u" }, nombre: "Test" } as any,
				origen: { nombre: "Almacén 1" } as any,
				destino: { nombre: "Almacén 2" } as any,
				puntoDeVentaOrigen: null,
				puntoDeVentaDestino: null,
			});
			mockCurrentTransfer({ estado: "COMPLETADA" });

			const result = await deleteTransferenciaAction("tr-1");
			expect(result.success).toBe(true);

			// Fase 3: debe revertir StockUbicacion en origen y destino
			const { upsertStockUbicacion } = await import(
				"@/lib/services/stock-ubicacion-service"
			);
			// Revertir origen (alm-1): +5 (devolver lo que salió)
			expect(upsertStockUbicacion).toHaveBeenCalledWith(
				mockTx,
				expect.objectContaining({
					productoId: "prod-1",
					tipoUbicacion: "almacen",
					ubicacionId: "alm-1",
					delta: 5,
				}),
			);
			// Revertir destino (alm-2): -5 (devolver lo que llegó)
			expect(upsertStockUbicacion).toHaveBeenCalledWith(
				mockTx,
				expect.objectContaining({
					productoId: "prod-1",
					tipoUbicacion: "almacen",
					ubicacionId: "alm-2",
					delta: -5,
				}),
			);
		});
	});

	describe("auth requerido", () => {
		it("retorna AUTH_REQUIRED", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);
			const result = await getTransferenciasAction();
			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("AUTH_REQUIRED");
		});
	});
});

describe("Kardex en ciclo de vida de transferencias", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockTx.stockMoveLine.findMany.mockResolvedValue([]);
		mockTx.transferencia.updateMany.mockResolvedValue({ count: 1 });
	});
	const movOriginal = (overrides: Record<string, unknown> = {}) => ([
		{
			id: "m-out",
			productoId: "prod-1",
			tipoUbicacion: "almacen",
			ubicacionId: "alm-1",
			cantidad: -5,
			costoUnitario: 1200,
			secuencia: "SALIDA-0",
			createdAt: new Date("2026-01-01"),
			...overrides,
		},
		{
			id: "m-in",
			productoId: "prod-1",
			tipoUbicacion: "punto_venta",
			ubicacionId: "pv-1",
			cantidad: 5,
			costoUnitario: 1200,
			secuencia: "ENTRADA-0",
			createdAt: new Date("2026-01-01"),
			...overrides,
		},
	]);

	it("editar una transferencia completada revierte kardex y registra la nueva versión", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
			transferenciaId: "tr-1",
			productoId: "prod-1",
			cantidad: 5,
			costoUnitario: 1200,
			origenId: "alm-1",
			destinoId: null,
			puntoDeVentaOrigenId: null,
			puntoDeVentaDestinoId: "pv-1",
			estado: "COMPLETADA",
			tenantId: "tenant-test",
			deletedAt: null,
		} as any);
		mockTx.stockMoveLine.findMany.mockResolvedValue(movOriginal());

		const result = await updateTransferenciaAction({
			transferenciaId: "tr-1",
			productoId: "prod-1",
			cantidad: 7,
			tipoOrigen: "almacen",
			origenId: "alm-1",
			tipoDestino: "punto_venta",
			destinoId: "pv-1",
		});

		expect(result.success).toBe(true);
		const secuencias = mockTx.stockMoveLine.upsert.mock.calls.map(
			(c: any) => c[0].where.eventoKey.secuencia,
		);
		expect(secuencias).toEqual([
			"REV-SALIDA-0",
			"REV-ENTRADA-0",
			"SALIDA-1",
			"ENTRADA-1",
		]);
		const salidaNueva = mockTx.stockMoveLine.upsert.mock.calls.find(
			(c: any) => c[0].where.eventoKey.secuencia === "SALIDA-1",
		);
		expect(salidaNueva![0].create.cantidad).toBe(-7);
		// Mantiene el costo histórico del documento, no el precio actual
		expect(salidaNueva![0].create.costoUnitario).toBe(1200);
	});

	it("eliminar una transferencia completada compensa su kardex", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
			transferenciaId: "tr-1",
			productoId: "prod-1",
			cantidad: 5,
			origenId: "alm-1",
			destinoId: null,
			puntoDeVentaOrigenId: null,
			puntoDeVentaDestinoId: "pv-1",
			estado: "COMPLETADA",
			tenantId: "tenant-test",
			deletedAt: null,
		} as any);
		mockTx.transferencia.findUnique.mockResolvedValue({
			transferenciaId: "tr-1",
			tenantId: "tenant-test",
			deletedAt: null,
			estado: "COMPLETADA",
			productoId: "prod-1",
			cantidad: 5,
			origenId: "alm-1",
			destinoId: null,
			puntoDeVentaOrigenId: null,
			puntoDeVentaDestinoId: "pv-1",
		} as any);
		mockTx.transferencia.updateMany.mockResolvedValue({ count: 1 });
		mockTx.stockMoveLine.findMany.mockResolvedValue(movOriginal());

		const result = await deleteTransferenciaAction("tr-1");

		expect(result.success).toBe(true);
		const secuencias = mockTx.stockMoveLine.upsert.mock.calls.map(
			(c: any) => c[0].where.eventoKey.secuencia,
		);
		expect(secuencias).toEqual(["REV-SALIDA-0", "REV-ENTRADA-0"]);
	});

	it("eliminar una transferencia PENDIENTE no genera compensaciones", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
			transferenciaId: "tr-1",
			estado: "PENDIENTE",
			tenantId: "tenant-test",
			deletedAt: null,
		} as any);
		mockTx.transferencia.findUnique.mockResolvedValue({
			transferenciaId: "tr-1",
			tenantId: "tenant-test",
			deletedAt: null,
			estado: "PENDIENTE",
			productoId: "prod-1",
			cantidad: 5,
			origenId: "alm-1",
			destinoId: "alm-2",
		} as any);
		mockTx.transferencia.updateMany.mockResolvedValue({ count: 1 });

		const result = await deleteTransferenciaAction("tr-1");

		expect(result.success).toBe(true);
		expect(mockTx.stockMoveLine.upsert).not.toHaveBeenCalled();
		expect(mockTx.stockMoveLine.findMany).not.toHaveBeenCalled();
	});
});
