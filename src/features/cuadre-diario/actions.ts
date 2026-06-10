/**
 * @description Server Actions para Cuadre Diario.
 * Corrige errores de schema: elimina includes/where inválidos,
 * mapea correctamente MetodoPagoVenta enum, y retorna datos
 * en el formato que el componente cliente espera.
 */
"use server";

import { withAction } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireFeature, requireTenant } from "@/lib/services/tenant-scope";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

/**
 * @description Formatea un Date a string ISO de fecha (YYYY-MM-DD).
 */
function formatoFecha(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * @description Formatea un Date a hora HH:mm (hora local).
 */
function formatHora(date: Date): string {
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const METODO_PAGO_LABEL: Record<string, string> = {
	EFECTIVO: "efectivo",
	TARJETA: "tarjeta",
	TRANSFERENCIA: "transferencia",
	CREDITO: "credito",
	MIXTO: "mixto",
};

/**
 * @description Calcula la variación porcentual entre ayer y hoy.
 */
function calcularVariacion(actual: number, anterior: number): number {
	if (anterior === 0) return actual > 0 ? 100 : 0;
	return ((actual - anterior) / anterior) * 100;
}

export const getCuadreDiarioAction = withAction(
	async (fecha: string, user: AuthenticatedUser) => {
		requireFeature(user, 'cuadre-diario', 'gestionar cuadre diario');
		const tenantId = requireTenant(user);

		const ahora = new Date();
		const f = fecha
			? new Date(fecha + "T00:00:00")
			: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
		const year = f.getFullYear();
		const month = String(f.getMonth() + 1).padStart(2, "0");
		const day = String(f.getDate()).padStart(2, "0");

		const fechaInicio = new Date(`${year}-${month}-${day}T00:00:00`);
		const fechaFin = new Date(`${year}-${month}-${day}T23:59:59.999`);

		// ── Consultas paralelas ──────────────────────────────────────
		const [
			ventasDelDia,
			ventaServiciosDelDia,
			gastosDEdelDia,
			gastosCompraDelDia,
			gastosSalariosDia,
			turnosDelDia,
			arqueosDelDia,
		] = await Promise.all([
			// Ventas del día (producto + punto de venta + cliente)
			prisma.venta.findMany({
				where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
				include: {
					producto: { select: { nombre: true, precioVenta: true } },
					puntoDeVenta: { select: { nombre: true } },
					cliente: { select: { nombre: true } },
				},
			}),
			// Servicios del día (sin puntoDeVenta — la relación no existe en el modelo)
			prisma.ventaServicios.findMany({
				where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
				include: {
					servicio: { select: { nombre: true } },
					cliente: { select: { nombre: true } },
				},
			}),
			// Gastos operativos
			prisma.gastosDE.findMany({
				where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
			}),
			// Compras con vendor
			prisma.gastoCompra.findMany({
				where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
				include: { vendor: { select: { nombre: true } } },
			}),
			// Pagos de salarios
			prisma.pagosalario.findMany({
				where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
				include: { empleado: { select: { nombre: true } } },
			}),
			// Turnos con fondos y arqueos
			prisma.turnoPuntoVenta.findMany({
				where: { tenantId, fechaApertura: { gte: fechaInicio, lte: fechaFin } },
				include: {
					puntoDeVenta: { select: { nombre: true } },
					arqueos: { orderBy: { createdAt: "desc" }, take: 1 },
					_count: { select: { ventas: true } },
				},
			}),
			// Arqueos del día
			prisma.arqueoCaja.findMany({
				where: { tenantId, createdAt: { gte: fechaInicio, lte: fechaFin } },
			}),
		]);

		// ── Totales (centavos → pesos) ────────────────────────────────
		const totalVentas = ventasDelDia.reduce(
			(sum, v) =>
				sum + (v.total ?? v.cantidad * (v.producto?.precioVenta ?? 0)),
			0,
		);
		const totalServicios = ventaServiciosDelDia.reduce(
			(sum, v) => sum + (v.total ?? 0),
			0,
		);
		const totalIngresos = totalVentas + totalServicios;

		const totalGastosDE = gastosDEdelDia.reduce((sum, g) => sum + g.monto, 0);
		const totalGastosSalarios = gastosSalariosDia.reduce(
			(sum, s) =>
				sum + s.salario + (s.bonificaciones ?? 0) + (s.horasExtras ?? 0),
			0,
		);
		const totalGastosCompra = gastosCompraDelDia.reduce(
			(sum, c) => sum + Number(c.total ?? 0),
			0,
		);
		const totalGastos = totalGastosDE + totalGastosSalarios + totalGastosCompra;
		const diferencia = totalIngresos - totalGastos;

		// ── Variación vs ayer ─────────────────────────────────────────
		const ayer = new Date(fechaInicio);
		ayer.setDate(ayer.getDate() - 1);
		const ayerInicio = new Date(
			ayer.getFullYear(),
			ayer.getMonth(),
			ayer.getDate(),
		);
		const ayerFin = new Date(
			ayer.getFullYear(),
			ayer.getMonth(),
			ayer.getDate(),
			23,
			59,
			59,
			999,
		);

		const [ventasAyer, serviciosAyer] = await Promise.all([
			prisma.venta.findMany({
				where: { createdAt: { gte: ayerInicio, lte: ayerFin }, tenantId },
			}),
			prisma.ventaServicios.findMany({
				where: { createdAt: { gte: ayerInicio, lte: ayerFin }, tenantId },
			}),
		]);

		const ingresosAyer =
			ventasAyer.reduce((sum, v) => {
				const monto = v.total ?? v.cantidad * ((v as any).precioVenta ?? 0);
				return sum + monto;
			}, 0) + serviciosAyer.reduce((sum, v) => sum + (v.total ?? 0), 0);

		const variacionVentas = calcularVariacion(totalIngresos, ingresosAyer);

		// ── Armar listado de ventas/servicios para la UI ──────────────
		const ventas: any[] = [];

		for (const v of ventasDelDia) {
			const total = v.total ?? v.cantidad * (v.producto?.precioVenta ?? 0);
			const metodoPago =
				METODO_PAGO_LABEL[v.metodoPago ?? "EFECTIVO"] ?? "efectivo";
			ventas.push({
				id: v.ventaId,
				hora: formatoFecha(v.createdAt),
				horaFormateada: formatHora(v.createdAt),
				cliente: v.cliente?.nombre ?? "Mostrador",
				producto: v.producto?.nombre ?? "Producto",
				cantidad: v.cantidad,
				total,
				metodoPago,
				esServicio: false,
				puntoDeVenta: v.puntoDeVenta?.nombre ?? "",
			});
		}

		for (const v of ventaServiciosDelDia) {
			const metodoPago = "transferencia";
			ventas.push({
				id: v.ventaServicioId,
				hora: formatoFecha(v.createdAt),
				horaFormateada: formatHora(v.createdAt),
				cliente: v.cliente?.nombre ?? "Mostrador",
				producto: v.servicio?.nombre ?? "Servicio",
				cantidad: v.cantidad,
				total: v.total ?? 0,
				metodoPago,
				esServicio: true,
				puntoDeVenta: "",
			});
		}

		// ── Armar listado de gastos/movimientos para la UI ────────────
		const gastos: any[] = [];

		for (const g of gastosDEdelDia) {
			gastos.push({
				id: g.gastosDEId,
				hora: formatoFecha(g.createdAt),
				horaFormateada: formatHora(g.createdAt),
				tipo: "gasto_operativo",
				descripcion: g.descripcion || g.tipo || "Gasto operativo",
				referencia: g.gastosDEId.slice(-8),
				monto: g.monto,
				bonificaciones: null,
				deducciones: null,
				observaciones: null,
				horasExtras: null,
			});
		}

		for (const c of gastosCompraDelDia) {
			gastos.push({
				id: c.gastoCompraId,
				hora: formatoFecha(c.createdAt),
				horaFormateada: formatHora(c.createdAt),
				tipo: "compra",
				descripcion: c.descripcion || (c.vendor?.nombre ?? "Compra"),
				referencia: c.numeroFactura || c.gastoCompraId.slice(-8),
				monto: Number(c.total ?? 0),
				bonificaciones: null,
				deducciones: null,
				observaciones: null,
				horasExtras: null,
			});
		}

		for (const s of gastosSalariosDia) {
			const monto = s.salario + (s.bonificaciones ?? 0) + (s.horasExtras ?? 0);
			gastos.push({
				id: s.pgId,
				hora: formatoFecha(s.createdAt),
				horaFormateada: formatHora(s.createdAt),
				tipo: "salario",
				descripcion: `Salario: ${s.empleado?.nombre ?? ""}`,
				referencia: s.pgId.slice(-8),
				monto,
				bonificaciones: s.bonificaciones,
				deducciones: s.deducciones,
				observaciones: s.observaciones,
				horasExtras: s.horasExtras,
			});
		}

		// ── Resumen por método de pago (como array) ──────────────────
		const mapaMetodos: Record<string, { cantidad: number; total: number }> = {};
		for (const op of ventas) {
			const mp = op.metodoPago;
			if (!mapaMetodos[mp]) {
				mapaMetodos[mp] = { cantidad: 0, total: 0 };
			}
			mapaMetodos[mp].cantidad++;
			mapaMetodos[mp].total += op.total;
		}

		const totalGeneral = Object.values(mapaMetodos).reduce(
			(s, m) => s + m.total,
			0,
		);
		const resumenMetodosPago = Object.entries(mapaMetodos).map(
			([metodo, info]) => ({
				metodo,
				cantidad: info.cantidad,
				total: info.total,
				porcentaje: totalGeneral > 0 ? (info.total / totalGeneral) * 100 : 0,
			}),
		);

		// ── Efectivo inicial / final ────────────────────────────────────
		const efectivoInicial =
			turnosDelDia.reduce((sum, t) => sum + t.fondoInicialCup, 0) / 100;
		const efectivoFinal =
			arqueosDelDia.length > 0
				? arqueosDelDia.reduce((sum, a) => sum + a.totalEfectivoCup, 0) / 100
				: turnosDelDia.reduce((sum, t) => {
						const ventasEfectivo = ventasDelDia
							.filter(
								(v) =>
									v.turnoId === t.id &&
									(v.metodoPago === "EFECTIVO" || v.metodoPago === "MIXTO"),
							)
							.reduce((s, v) => s + (v.montoEfectivo ?? 0), 0);
						return sum + t.fondoInicialCup + ventasEfectivo;
					}, 0) / 100;

		// ── Response ─────────────────────────────────────────────────
		return {
			resumen: {
				fecha: formatoFecha(f),
				totalVentas,
				totalServicios,
				totalIngresos,
				totalGastosDE,
				totalGastosSalarios,
				totalGastosCompra,
				totalGastos,
				diferencia,
				variacionPorcentual: variacionVentas,
				ingresosAyer,
			},
			ventas,
			gastos,
			resumenMetodosPago,
			totales: { efectivoInicial, efectivoFinal },
			turnosDelDia: turnosDelDia.map((t) => ({
				id: t.id,
				puntoDeVenta: t.puntoDeVenta?.nombre ?? "Desconocido",
				estado: t.estado,
				fondoInicialCup: (t.fondoInicialCup ?? 0) / 100,
				fondoInicialUsd: (t.fondoInicialUsd ?? 0) / 100,
				totalVentas: t._count?.ventas ?? 0,
				tieneArqueo: (t.arqueos?.length ?? 0) > 0,
				arqueo: t.arqueos?.[0]
					? {
							totalEfectivoCup: (t.arqueos[0].totalEfectivoCup ?? 0) / 100,
							totalEfectivoUsd: (t.arqueos[0].totalEfectivoUsd ?? 0) / 100,
							diferenciaCup: (t.arqueos[0].diferenciaCup ?? 0) / 100,
							diferenciaUsd: (t.arqueos[0].diferenciaUsd ?? 0) / 100,
						}
					: null,
			})),
			arqueosDelDia: arqueosDelDia.map((a) => ({
				id: a.id,
				totalEfectivoCup: (a.totalEfectivoCup ?? 0) / 100,
				totalEfectivoUsd: (a.totalEfectivoUsd ?? 0) / 100,
				diferenciaCup: (a.diferenciaCup ?? 0) / 100,
				diferenciaUsd: (a.diferenciaUsd ?? 0) / 100,
			})),
		};
	},
);
