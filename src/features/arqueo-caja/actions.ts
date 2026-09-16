/**
 * @description Server Actions para la feature de Arqueo de Caja.
 */
"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/services/tenant-scope";
import { getReembolsosTurnoCup } from "@/lib/services/reembolsos-turno";
import { realizarArqueoSchema, listarArqueosSchema } from "./schemas";
import type { RealizarArqueoInput, ListarArqueosInput } from "./schemas";
import type { EsperadosArqueo } from "./types";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ─── Constantes ───────────────────────────────────────────

const UMBRAL_DIFERENCIA_DEFAULT = 50000; // $500.00 CUP en centavos

// ─── Helpers ──────────────────────────────────────────────

/**
 * @description Calcula el total en efectivo CUP desde el conteo de billetes.
 */
function calcularTotalCup(conteo: {
	billetes1000Cup: number;
	billetes500Cup: number;
	billetes200Cup: number;
	billetes100Cup: number;
	billetes50Cup: number;
	billetes20Cup: number;
	billetes10Cup: number;
	billetes5Cup: number;
	billetes1Cup: number;
	monedasCup: number;
}): number {
	return (
		conteo.billetes1000Cup * 100000 +
		conteo.billetes500Cup * 50000 +
		conteo.billetes200Cup * 20000 +
		conteo.billetes100Cup * 10000 +
		conteo.billetes50Cup * 5000 +
		conteo.billetes20Cup * 2000 +
		conteo.billetes10Cup * 1000 +
		conteo.billetes5Cup * 500 +
		conteo.billetes1Cup * 100 +
		conteo.monedasCup
	);
}

/**
 * @description Calcula el total en efectivo USD desde el conteo de billetes (en centavos de USD).
 */
function calcularTotalUsd(conteo: {
	billetes100Usd: number;
	billetes50Usd: number;
	billetes20Usd: number;
	billetes10Usd: number;
	billetes5Usd: number;
	billetes1Usd: number;
	monedasUsd: number;
}): number {
	return (
		conteo.billetes100Usd * 10000 +
		conteo.billetes50Usd * 5000 +
		conteo.billetes20Usd * 2000 +
		conteo.billetes10Usd * 1000 +
		conteo.billetes5Usd * 500 +
		conteo.billetes1Usd * 100 +
		conteo.monedasUsd
	);
}

// ─── Server Actions ───────────────────────────────────────

/**
 * @description Calcula los valores esperados de caja para un turno.
 * Suma el fondo inicial más todas las ventas del turno desglosadas por método de pago.
 *
 * @param {string} turnoId - ID del turno
 * @returns {Promise<EsperadosArqueo>} Valores esperados
 * @throws {ActionError} Si el turno no existe o no pertenece al tenant
 */
export const getEsperadosArqueoAction = withAction(
	async (turnoId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		const turno = await prisma.turnoPuntoVenta.findFirst({
			where: { id: turnoId, tenantId },
			include: {
				ventas: {
					where: { deletedAt: null },
					select: {
						metodoPago: true,
						montoEfectivo: true,
						montoTarjeta: true,
						montoTransferencia: true,
						montoCredito: true,
						total: true,
					},
				},
			},
		});

		if (!turno) throw new ActionError("Turno no encontrado", "NOT_FOUND");

		const ventasEfectivoCup = turno.ventas
			.filter((v) => v.metodoPago === "EFECTIVO" || v.metodoPago === "MIXTO")
			.reduce((sum, v) => sum + (v.montoEfectivo ?? 0), 0);

		// DNC: los reembolsos en efectivo del turno descuentan el esperado.
		const reembolsosCup = await getReembolsosTurnoCup(turno.id, tenantId);

		// USD se calcula desde fondoInicialUsd (las ventas en USD requerirían tipo de cambio)
		const ventasEfectivoUsd = 0;

		return {
			esperadoEfectivoCup: ventasEfectivoCup - reembolsosCup, // sin fondoInicial — se descuenta al mostrar
			esperadoEfectivoUsd: turno.fondoInicialUsd + ventasEfectivoUsd,
			esperadoTarjeta: turno.ventas
				.filter((v) => v.metodoPago === "TARJETA" || v.metodoPago === "MIXTO")
				.reduce((sum, v) => sum + (v.montoTarjeta ?? 0), 0),
			esperadoTransferencia: turno.ventas
				.filter(
					(v) => v.metodoPago === "TRANSFERENCIA" || v.metodoPago === "MIXTO",
				)
				.reduce((sum, v) => sum + (v.montoTransferencia ?? 0), 0),
			esperadoCredito: turno.ventas
				.filter((v) => v.metodoPago === "CREDITO" || v.metodoPago === "MIXTO")
				.reduce((sum, v) => sum + (v.montoCredito ?? 0), 0),
			fondoInicialCup: turno.fondoInicialCup,
			fondoInicialUsd: turno.fondoInicialUsd,
			ventasEfectivoCup,
			ventasEfectivoUsd,
		};
	},
);

/**
 * @description Realiza el arqueo de caja de un turno: registra el conteo físico,
 * calcula los esperados desde las ventas y determina diferencias.
 * NO cierra el turno — eso se hace desde CuadreTurnoDialog.
 *
 * @param {RealizarArqueoInput} input - Conteo físico y datos del arqueo
 * @returns {Promise<{ arqueo: ArqueoCaja, diferencias: { cup: number, usd: number } }>}
 * @throws {ActionError} Si el turno no existe, no está abierto, o ya tiene arqueo
 */
export const realizarArqueoAction = withAction(
	async (input: RealizarArqueoInput, user: AuthenticatedUser) => {
		const parsed = realizarArqueoSchema.parse(input);
		const tenantId = requireTenant(user);

		// 1. Validar turno
		const turno = await prisma.turnoPuntoVenta.findFirst({
			where: { id: parsed.turnoId, tenantId },
			include: {
				ventas: {
					where: { deletedAt: null },
					select: {
						metodoPago: true,
						montoEfectivo: true,
						montoTarjeta: true,
						montoTransferencia: true,
						montoCredito: true,
					},
				},
			},
		});

		if (!turno) throw new ActionError("Turno no encontrado", "NOT_FOUND");
		if (turno.estado !== "ABIERTO") {
			throw new ActionError("El turno ya está cerrado", "CONFLICT");
		}
		// Se permiten múltiples arqueos (conteos) por turno

		// 2. Calcular totales físicos
		const totalEfectivoCup = calcularTotalCup(parsed);
		const totalEfectivoUsd = calcularTotalUsd(parsed);
		const totalTarjeta = parsed.totalTarjeta;
		const totalTransferencia = parsed.totalTransferencia;
		const totalCredito = parsed.totalCredito;

		// 3. Calcular esperados desde las ventas (sin fondoInicial — se descuenta al mostrar la diferencia)
		const esperadoEfectivoCup =
			turno.ventas
				.filter((v) => v.metodoPago === "EFECTIVO" || v.metodoPago === "MIXTO")
				.reduce((sum, v) => sum + (v.montoEfectivo ?? 0), 0) -
			(await getReembolsosTurnoCup(turno.id, tenantId));

		const esperadoEfectivoUsd = turno.fondoInicialUsd;

		const esperadoTarjeta = turno.ventas
			.filter((v) => v.metodoPago === "TARJETA" || v.metodoPago === "MIXTO")
			.reduce((sum, v) => sum + (v.montoTarjeta ?? 0), 0);

		const esperadoTransferencia = turno.ventas
			.filter((v) => v.metodoPago === "TRANSFERENCIA")
			.reduce((sum, v) => sum + (v.montoTransferencia ?? 0), 0);

		const esperadoCredito = turno.ventas
			.filter((v) => v.metodoPago === "CREDITO" || v.metodoPago === "MIXTO")
			.reduce((sum, v) => sum + (v.montoCredito ?? 0), 0);

		// 4. Calcular diferencias (descontando fondoInicial del efectivo contado)
		const diferenciaCup =
			totalEfectivoCup - turno.fondoInicialCup - esperadoEfectivoCup;
		const diferenciaUsd = totalEfectivoUsd - esperadoEfectivoUsd;

		// 5. Crear arqueo (ya NO cierra el turno; eso se hace desde CuadreTurnoDialog)
		const result = await prisma.arqueoCaja.create({
			data: {
				turnoId: parsed.turnoId,
				tenantId,
				puntoDeVentaId: turno.puntoDeVentaId,
				// Conteo CUP
				billetes1000Cup: parsed.billetes1000Cup,
				billetes500Cup: parsed.billetes500Cup,
				billetes200Cup: parsed.billetes200Cup,
				billetes100Cup: parsed.billetes100Cup,
				billetes50Cup: parsed.billetes50Cup,
				billetes20Cup: parsed.billetes20Cup,
				billetes10Cup: parsed.billetes10Cup,
				billetes5Cup: parsed.billetes5Cup,
				billetes1Cup: parsed.billetes1Cup,
				monedasCup: parsed.monedasCup,
				// Conteo USD
				billetes100Usd: parsed.billetes100Usd,
				billetes50Usd: parsed.billetes50Usd,
				billetes20Usd: parsed.billetes20Usd,
				billetes10Usd: parsed.billetes10Usd,
				billetes5Usd: parsed.billetes5Usd,
				billetes1Usd: parsed.billetes1Usd,
				monedasUsd: parsed.monedasUsd,
				// Totales físicos
				totalEfectivoCup,
				totalEfectivoUsd,
				totalTarjeta,
				totalTransferencia,
				totalCredito,
				// Esperados
				esperadoEfectivoCup,
				esperadoEfectivoUsd,
				esperadoTarjeta,
				esperadoTransferencia,
				esperadoCredito,
				// Diferencias
				diferenciaCup,
				diferenciaUsd,
				observaciones: parsed.observaciones ?? null,
			},
		});

		revalidatePath("/busy/puntosDeVenta");
		revalidatePath("/busy/sales");

		const advertencia =
			Math.abs(diferenciaCup) > UMBRAL_DIFERENCIA_DEFAULT
				? `Diferencia de ${(diferenciaCup / 100).toFixed(2)} CUP excede el umbral permitido`
				: undefined;

		return {
			arqueo: result,
			diferencias: { cup: diferenciaCup, usd: diferenciaUsd },
			...(advertencia ? { advertencia } : {}),
		};
	},
);

/**
 * @description Lista arqueos de caja con filtros opcionales.
 * Incluye datos del turno, punto de venta y empleado.
 *
 * @param {ListarArqueosInput} input - Filtros (fecha, PV, solo diferencias)
 * @returns {Promise<ArqueoCajaConRelaciones[]>} Lista de arqueos
 */
export const getArqueosAction = withAction(
	async (input: ListarArqueosInput, user: AuthenticatedUser) => {
		const parsed = listarArqueosSchema.parse(input);
		const tenantId = requireTenant(user);

		const where: Record<string, unknown> = { tenantId };

		if (parsed.puntoDeVentaId) {
			where.puntoDeVentaId = parsed.puntoDeVentaId;
		}

		if (parsed.soloConDiferencia) {
			where.OR = [{ diferenciaCup: { not: 0 } }, { diferenciaUsd: { not: 0 } }];
		}

		if (parsed.fechaDesde || parsed.fechaHasta) {
			where.createdAt = {};
			if (parsed.fechaDesde) {
				(where.createdAt as Record<string, unknown>).gte = new Date(
					`${parsed.fechaDesde}T00:00:00`,
				);
			}
			if (parsed.fechaHasta) {
				(where.createdAt as Record<string, unknown>).lte = new Date(
					`${parsed.fechaHasta}T23:59:59.999`,
				);
			}
		}

		const arqueos = await prisma.arqueoCaja.findMany({
			where,
			include: {
				turno: {
					include: {
						puntoDeVenta: { select: { pvId: true, nombre: true } },
						empleado: {
							select: { empleadoId: true, nombre: true, apellido: true },
						},
					},
				},
			},
			orderBy: { createdAt: "desc" },
			take: parsed.limit,
		});

		return arqueos;
	},
);
