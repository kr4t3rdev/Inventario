/**
 * @description Tests de los schemas Zod de transferencias (Sesión B).
 */
import { describe, expect, it } from "vitest";
import {
	createTransferenciaSchema,
	updateTransferenciaSchema,
} from "@/features/transferencias/schemas";

const CREATE_BASE = {
	productos: [{ productoId: "prod-1", cantidad: 1 }],
	tipoOrigen: "almacen",
	origenId: "alm-1",
	tipoDestino: "almacen",
	destinoId: "alm-2",
} as const;

const UPDATE_BASE = {
	transferenciaId: "tr-1",
	productoId: "prod-1",
	cantidad: 5,
	tipoOrigen: "almacen",
	origenId: "alm-1",
	tipoDestino: "almacen",
	destinoId: "alm-2",
} as const;

describe("B-3: schemas de transferencias (Sesión B)", () => {
	it("updateTransferenciaSchema descarta el input muerto de estado", () => {
		const parsed = updateTransferenciaSchema.parse({
			...UPDATE_BASE,
			estado: "COMPLETADA",
		});

		expect("estado" in parsed).toBe(false);
	});

	it("createTransferenciaSchema acepta PENDIENTE y COMPLETADA", () => {
		expect(() =>
			createTransferenciaSchema.parse({ ...CREATE_BASE, estado: "PENDIENTE" }),
		).not.toThrow();
		expect(() =>
			createTransferenciaSchema.parse({ ...CREATE_BASE, estado: "COMPLETADA" }),
		).not.toThrow();
	});

	it("createTransferenciaSchema mantiene COMPLETADA como estado por defecto", () => {
		const parsed = createTransferenciaSchema.parse({ ...CREATE_BASE });

		expect(parsed.estado).toBe("COMPLETADA");
	});

	it("createTransferenciaSchema rechaza estados incoherentes al crear", () => {
		for (const estado of [
			"EN_TRANSITO",
			"PARCIAL",
			"RECHAZADA",
			"CANCELADA",
		] as const) {
			expect(() =>
				createTransferenciaSchema.parse({ ...CREATE_BASE, estado }),
			).toThrow();
		}
	});
});
