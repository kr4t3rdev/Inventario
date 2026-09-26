/**
 * @description Tests de los helpers puros de flujo de estados de transferencias.
 */
import { describe, expect, it } from "vitest";
import type { EstadoTransferencia } from "@/app/models/model";
import {
	ESTADOS_RECEPCION_PERMITIDOS,
	puedeConfirmarRecepcion,
	puedeDespachar,
} from "@/features/transferencias/lib/estados";

const TODOS_LOS_ESTADOS: EstadoTransferencia[] = [
	"PENDIENTE",
	"APROBADA",
	"EN_TRANSITO",
	"COMPLETADA",
	"RECHAZADA",
	"CANCELADA",
	"PARCIAL",
];

describe("puedeDespachar", () => {
	it("solo habilita el despacho de transferencias aprobadas", () => {
		const habilitados = TODOS_LOS_ESTADOS.filter((e) => puedeDespachar(e));
		expect(habilitados).toEqual(["APROBADA"]);
	});
});

describe("puedeConfirmarRecepcion", () => {
	it("habilita recepción sobre aprobadas, en tránsito y parciales", () => {
		const habilitados = TODOS_LOS_ESTADOS.filter((e) =>
			puedeConfirmarRecepcion(e),
		);
		expect(habilitados).toEqual(["APROBADA", "EN_TRANSITO", "PARCIAL"]);
	});

	it("expone los estados recepcionables como constante pública", () => {
		expect(ESTADOS_RECEPCION_PERMITIDOS).toEqual([
			"APROBADA",
			"EN_TRANSITO",
			"PARCIAL",
		]);
	});
});
