import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	upsertStockUbicacion,
	incrementarStock,
	descontarStock,
	transferirStock,
	revertirMovimiento,
} from "../stock-ubicacion-service";

const txMock = {
	stockUbicacion: { upsert: vi.fn(), findUnique: vi.fn() },
	producto: {
		findUniqueOrThrow: vi.fn().mockResolvedValue({ tenantId: "tenant-1" }),
	},
};

describe("upsertStockUbicacion", () => {
	beforeEach(() => vi.clearAllMocks());

	it("llama a upsert con increment cuando modo es increment", async () => {
		txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

		await upsertStockUbicacion(txMock as any, {
			productoId: "prod-1",
			tipoUbicacion: "almacen",
			ubicacionId: "alm-1",
			modo: "increment",
			delta: 5,
		});

		expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: "prod-1",
					tipoUbicacion: "almacen",
					ubicacionId: "alm-1",
				},
			},
			update: {
				cantidad: { increment: 5 },
				cantidadDisponible: { increment: 5 },
			},
			create: {
				tenantId: "tenant-1",
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				cantidad: 5,
				cantidadReservada: 0,
				cantidadDisponible: 5,
			},
		});
	});

	it("llama a upsert con set cuando modo es set", async () => {
		txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

		await upsertStockUbicacion(txMock as any, {
			productoId: "prod-1",
			tipoUbicacion: "almacen",
			ubicacionId: "alm-1",
			modo: "set",
			valor: 20,
		});

		expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: "prod-1",
					tipoUbicacion: "almacen",
					ubicacionId: "alm-1",
				},
			},
			update: {
				cantidad: 20,
				cantidadReservada: 0,
				cantidadDisponible: 20,
			},
			create: {
				tenantId: "tenant-1",
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				cantidad: 20,
				cantidadReservada: 0,
				cantidadDisponible: 20,
			},
		});
	});

	describe("cantidadReservada", () => {
		it("increment con cantidadReservada y registro existente calcula cantidadDisponible correctamente", async () => {
			txMock.stockUbicacion.findUnique.mockResolvedValue({ cantidad: 10 });
			txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

			await upsertStockUbicacion(txMock as any, {
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				modo: "increment",
				delta: 5,
				cantidadReservada: 3,
			});

			// cantidadDisponible = (existing.cantidad 10 + delta 5) - cantidadReservada 3 = 12
			expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: "prod-1",
						tipoUbicacion: "almacen",
						ubicacionId: "alm-1",
					},
				},
				update: {
					cantidad: { increment: 5 },
					cantidadReservada: 3,
					cantidadDisponible: 12,
				},
				create: {
					tenantId: "tenant-1",
					productoId: "prod-1",
					tipoUbicacion: "almacen",
					ubicacionId: "alm-1",
					cantidad: 5,
					cantidadReservada: 3,
					cantidadDisponible: 2,
				},
			});
		});

		it("increment con cantidadReservada y delta negativo descuenta correctamente", async () => {
			txMock.stockUbicacion.findUnique.mockResolvedValue({ cantidad: 15 });
			txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

			await upsertStockUbicacion(txMock as any, {
				productoId: "prod-1",
				tipoUbicacion: "punto_venta",
				ubicacionId: "pv-1",
				modo: "increment",
				delta: -3,
				cantidadReservada: 2,
			});

			// cantidadDisponible = (15 + -3) - 2 = 10
			expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						cantidad: { increment: -3 },
						cantidadReservada: 2,
						cantidadDisponible: 10,
					}),
				}),
			);
		});

		it("increment con cantidadReservada y sin registro existente usa create", async () => {
			txMock.stockUbicacion.findUnique.mockResolvedValue(null);
			txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

			await upsertStockUbicacion(txMock as any, {
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				modo: "increment",
				delta: 10,
				cantidadReservada: 4,
			});

			expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						cantidadDisponible: 6, // 10 - 4
					}),
					create: expect.objectContaining({
						cantidad: 10,
						cantidadReservada: 4,
						cantidadDisponible: 6,
					}),
				}),
			);
		});
	});

	describe("set con cantidadReservada", () => {
		it("set con cantidadReservada explicita", async () => {
			txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

			await upsertStockUbicacion(txMock as any, {
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				modo: "set",
				valor: 20,
				cantidadReservada: 5,
			});

			expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: "prod-1",
						tipoUbicacion: "almacen",
						ubicacionId: "alm-1",
					},
				},
				update: {
					cantidad: 20,
					cantidadReservada: 5,
					cantidadDisponible: 15, // 20 - 5
				},
				create: {
					tenantId: "tenant-1",
					productoId: "prod-1",
					tipoUbicacion: "almacen",
					ubicacionId: "alm-1",
					cantidad: 20,
					cantidadReservada: 5,
					cantidadDisponible: 15,
				},
			});
		});
	});

	it("funciona con tipoUbicacion punto_venta", async () => {
		txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-2" });

		await upsertStockUbicacion(txMock as any, {
			productoId: "prod-1",
			tipoUbicacion: "punto_venta",
			ubicacionId: "pv-1",
			modo: "increment",
			delta: -3,
		});

		expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: "prod-1",
						tipoUbicacion: "punto_venta",
						ubicacionId: "pv-1",
					},
				},
				update: expect.objectContaining({
					cantidad: { increment: -3 },
				}),
			}),
		);
	});

	describe("incrementarStock", () => {
		it("incrementa stock con delta positivo", async () => {
			txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

			await incrementarStock(txMock as any, {
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				cantidad: 10,
			});

			expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						cantidad: { increment: 10 },
					}),
				}),
			);
		});

		it("incrementar con cantidadReservada", async () => {
			txMock.stockUbicacion.findUnique.mockResolvedValue({ cantidad: 5 });
			txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

			await incrementarStock(txMock as any, {
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				cantidad: 3,
				cantidadReservada: 2,
			});

			expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						cantidad: { increment: 3 },
						cantidadReservada: 2,
					}),
				}),
			);
		});
	});

	describe("descontarStock", () => {
		it("descuenta stock con delta negativo", async () => {
			txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

			await descontarStock(txMock as any, {
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				cantidad: 5,
			});

			expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						cantidad: { increment: -5 },
					}),
				}),
			);
		});
	});

	describe("transferirStock", () => {
		it("transfiere stock entre dos ubicaciones", async () => {
			txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

			await transferirStock(txMock as any, {
				productoId: "prod-1",
				origenTipo: "almacen",
				origenId: "alm-1",
				destinoTipo: "punto_venta",
				destinoId: "pv-1",
				cantidad: 8,
			});

			expect(txMock.stockUbicacion.upsert).toHaveBeenCalledTimes(2);

			// Primera llamada: descuenta del origen
			expect(txMock.stockUbicacion.upsert).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					create: expect.objectContaining({
						tipoUbicacion: "almacen",
						ubicacionId: "alm-1",
						cantidad: -8,
					}),
				}),
			);

			// Segunda llamada: suma al destino
			expect(txMock.stockUbicacion.upsert).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					create: expect.objectContaining({
						tipoUbicacion: "punto_venta",
						ubicacionId: "pv-1",
						cantidad: 8,
					}),
				}),
			);
		});
	});

	describe("revertirMovimiento", () => {
		it("revierte un movimiento previo", async () => {
			txMock.stockUbicacion.upsert.mockResolvedValue({ id: "su-1" });

			await revertirMovimiento(txMock as any, {
				productoId: "prod-1",
				tipoUbicacion: "almacen",
				ubicacionId: "alm-1",
				cantidad: 10,
			});

			expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						cantidad: { increment: -10 },
					}),
				}),
			);
		});
	});
});
