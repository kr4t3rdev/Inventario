/**
 * @description Helpers de consulta para la pantalla de cuadre al cerrar período.
 *
 * Proporciona funciones de agregación y consulta que alimentan los 4 tabs
 * del modal CuadrePeriodoModal: balance, ventas vs reconciliado,
 * operaciones del período y resumen diario.
 *
 * @module cuadre-queries
 */

import { prisma } from "@/lib/prisma";

// ── Tipos compartidos ─────────────────────────────────────────────────────

export interface SaldoCuentaData {
	cuentaId: string;
	nombre: string;
	moneda: string;
	saldoActual: number;
	saldoInicioPeriodo: number;
	variacion: number;
}

export interface TotalesMoneda {
	moneda: string;
	totalIngresos: number;
	totalEgresos: number;
	saldoNeto: number;
}

export interface BalanceData {
	saldosPorCuenta: SaldoCuentaData[];
	totalesPorMoneda: TotalesMoneda[];
}

export interface VentaVsReconciliadoItem {
	id: string;
	tipo: "VENTA" | "SERVICIO" | "GASTO";
	folio: string | null;
	fecha: Date;
	monto: number;
	moneda: string;
	metodoPago: string | null;
	origen: string | null;
	estaReconciliado: boolean;
	montoReconciliado: number | null;
	diferencia: number;
	fechaReconciliacion: Date | null;
	clasificacion?:
		| "RECONCILIADA"
		| "RECONCILIADA_PARCIALMENTE"
		| "CONCILIABLE"
		| "CUENTA_POR_COBRAR"
		| "CUENTA_POR_PAGAR"
		| "EXCLUIDA"
		| "NO_CLASIFICADA";
	estadoCuenta?: string | null;
}

interface ReconciliationAmount {
	monto: number | { toString(): string };
	montoConvertido?: number | { toString(): string } | null;
}

/**
 * @description Classifies an operation from its remaining balance and active debt status.
 * @param {number} total - Operation amount in functional currency.
 * @param {ReconciliationAmount[]} rows - All reconciliation amounts for the operation.
 * @param {string | null} accountState - Linked receivable/payable state, when present.
 * @param {"CUENTA_POR_COBRAR" | "CUENTA_POR_PAGAR"} accountType - Linked debt kind.
 * @returns {object} Reconciliation amount, balance, state and eligibility classification.
 */
function classifyReconciliation(
	total: number,
	rows: ReconciliationAmount[],
	accountState: string | null,
	accountType: "CUENTA_POR_COBRAR" | "CUENTA_POR_PAGAR",
) {
	const reconciledAmount = rows.reduce(
		(sum, row) => sum + Number(row.montoConvertido ?? row.monto ?? 0),
		0,
	);
	const difference = total - reconciledAmount;
	const normalizedState = accountState?.toUpperCase() ?? null;
	const activeDebt = normalizedState === "PENDIENTE" || normalizedState === "PARCIAL";
	const fullyReconciled = reconciledAmount > 0 && difference <= 0.1;
	const partiallyReconciled = reconciledAmount > 0.1 && difference > 0.1;
	const classification = activeDebt
		? accountType
		: fullyReconciled
			? "RECONCILIADA"
			: partiallyReconciled
				? "RECONCILIADA_PARCIALMENTE"
				: normalizedState && normalizedState !== "PAGADA"
					? "EXCLUIDA"
					: "CONCILIABLE";

	return {
		estaReconciliado: fullyReconciled,
		montoReconciliado: reconciledAmount > 0 ? reconciledAmount : null,
		diferencia: difference,
		clasificacion: classification as VentaVsReconciliadoItem["clasificacion"],
	};
}

export interface VentasVsReconciliadoData {
	items: VentaVsReconciliadoItem[];
	itemsAntiguos: VentaVsReconciliadoItem[];
	totales: {
		totalVentas: number;
		totalReconciliado: number;
		diferencia: number;
		cantidadVentas: number;
		cantidadReconciliadas: number;
		cantidadPendientes: number;
		totalGastos: number;
		cantidadGastos: number;
		cantidadGastosReconciliados: number;
		cantidadGastosPendientes: number;
	};
	totalPages: number;
	page: number;
}

export interface ResumenDiarioItem {
	fecha: string;
	totalIngresos: number;
	totalEgresos: number;
	neto: number;
	cantidadOperaciones: number;
	desglose: Array<{
		tipo: string;
		monto: number;
		cantidad: number;
	}>;
}

export interface OperacionItem {
	id: string;
	tipo:
		| "VENTA"
		| "SERVICIO"
		| "GASTO"
		| "TRANSFERENCIA"
		| "AJUSTE"
		| "CAPITAL"
		| "PAGO_DEUDA"
		| "PRESTAMO";
	descripcion: string;
	fecha: Date;
	monto: number;
	moneda: string;
	referencia: string | null;
	cuentaId: string | null;
	cuentaNombre: string | null;
}

export interface OperacionesData {
	items: OperacionItem[];
	totalPages: number;
	page: number;
	totalCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Determina el campo de fecha para reconciliaciones según el modo contable.
 * CAJA → fechaReconciliacion, DEVENGO → createdAt.
 */
function fieldReconciliacion(
	modo: string,
): "fechaReconciliacion" | "createdAt" {
	return modo === "CAJA" ? "fechaReconciliacion" : "createdAt";
}

/**
 * Redondea un número a 2 decimales.
 */
function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

/**
 * @description Calcula el cambio neto de una cuenta bancaria en un rango de fechas.
 *
 * Suma ingresos (reconciliaciones de ventas/servicios, transferencias destino,
 * inyecciones de capital) y resta egresos (gastos, ajustes, transferencias origen,
 * pagos de deuda).
 *
 * @param {string} cuentaId - ID de la cuenta bancaria.
 * @param {string} tenantId - ID del tenant.
 * @param {{ gte: Date; lte: Date }} rango - Rango de fechas del período.
 * @param {'fechaReconciliacion' | 'createdAt'} field - Campo de fecha según modo contable.
 * @returns {Promise<number>} Cambio neto (positivo = ingresos > egresos).
 */
async function calcularCambioNetoCuenta(
	cuentaId: string,
	tenantId: string,
	rango: { gte: Date; lte: Date },
	field: "fechaReconciliacion" | "createdAt",
): Promise<number> {
	const usarCaja = field === "fechaReconciliacion";
	const filtroRec = usarCaja
		? { fechaReconciliacion: rango }
		: { createdAt: rango };

	// ── Ingresos ──
	const ventas = await prisma.reconciliacionVenta.aggregate({
		_sum: { montoConvertido: true },
		where: { tenantId, cuentaId, ...filtroRec },
	});
	const servicios = await prisma.reconciliacionServicio.aggregate({
		_sum: { montoConvertido: true },
		where: { tenantId, cuentaId, ...filtroRec },
	});
	const tfDestino = await prisma.transferenciaBancaria.aggregate({
		_sum: { montoDestino: true },
		where: { tenantId, cuentaDestinoId: cuentaId, fechaTransferencia: rango },
	});
	const capital = await prisma.inyeccionCapital.aggregate({
		_sum: { montoRecibido: true },
		where: { cuentaBancaria: { tenantId }, cuentaId, createdAt: rango },
	});

	// ── Egresos ──
	const gastos = await prisma.reconciliacionGasto.aggregate({
		_sum: { montoConvertido: true },
		where: { tenantId, cuentaId, ...filtroRec },
	});
	const ajustes = await prisma.ajusteBancario.aggregate({
		_sum: { montoConvertido: true },
		where: { tenantId, cuentaId, createdAt: rango },
	});
	const tfOrigen = await prisma.transferenciaBancaria.aggregate({
		_sum: { montoOrigen: true },
		where: { tenantId, cuentaOrigenId: cuentaId, fechaTransferencia: rango },
	});
	const pagos = await prisma.pagoDeuda.aggregate({
		_sum: { montoPagado: true },
		where: { cuentaBancaria: { tenantId }, cuentaId, fechaPago: rango },
	});

	const ingresos =
		Number(ventas._sum.montoConvertido ?? 0) +
		Number(servicios._sum.montoConvertido ?? 0) +
		Number(tfDestino._sum.montoDestino ?? 0) +
		Number(capital._sum.montoRecibido ?? 0);

	const egresos =
		Number(gastos._sum.montoConvertido ?? 0) +
		Number(ajustes._sum.montoConvertido ?? 0) +
		Number(tfOrigen._sum.montoOrigen ?? 0) +
		Number(pagos._sum.montoPagado ?? 0);

	return ingresos - egresos;
}

/**
 * @description Obtiene el balance de cuentas con variación vs inicio del período.
 *
 * El saldo de inicio del período se deduce restando el cambio neto
 * del período al saldo actual de cada cuenta.
 *
 * @param {string} tenantId - ID del tenant.
 * @param {{ gte: Date; lte: Date }} rango - Rango de fechas del período.
 * @param {string} modoContable - "CAJA" | "DEVENGO".
 * @returns {Promise<BalanceData>} Saldos por cuenta y totales por moneda.
 */
export async function obtenerBalanceConVariacion(
	tenantId: string,
	rango: { gte: Date; lte: Date },
	modoContable: string,
): Promise<BalanceData> {
	const cuentas = await prisma.cuentaBancaria.findMany({
		where: { tenantId, isActive: true },
		orderBy: { moneda: "asc" },
	});

	const field = fieldReconciliacion(modoContable);

	const saldosPorCuenta: SaldoCuentaData[] = [];
	const totalsByMoneda: Record<string, { ingresos: number; egresos: number }> =
		{};

	for (const cuenta of cuentas) {
		const saldoActual = Number(cuenta.saldo ?? 0);

		const cambioNeto = await calcularCambioNetoCuenta(
			cuenta.cuentaId,
			tenantId,
			rango,
			field,
		);

		const neto = round2(Number(cambioNeto ?? 0));
		const saldoInicio = round2(saldoActual - neto);

		saldosPorCuenta.push({
			cuentaId: cuenta.cuentaId,
			nombre: cuenta.nombreBanco ?? "Sin nombre",
			moneda: cuenta.moneda,
			saldoActual,
			saldoInicioPeriodo: saldoInicio,
			variacion: neto,
		});

		if (!totalsByMoneda[cuenta.moneda]) {
			totalsByMoneda[cuenta.moneda] = { ingresos: 0, egresos: 0 };
		}
		if (neto >= 0) {
			totalsByMoneda[cuenta.moneda].ingresos += neto;
		} else {
			totalsByMoneda[cuenta.moneda].egresos += Math.abs(neto);
		}
	}

	const totalesPorMoneda: TotalesMoneda[] = Object.entries(totalsByMoneda).map(
		([moneda, v]) => ({
			moneda,
			totalIngresos: round2(v.ingresos),
			totalEgresos: round2(v.egresos),
			saldoNeto: round2(v.ingresos - v.egresos),
		}),
	);

	return { saldosPorCuenta, totalesPorMoneda };
}

/**
 * @description Obtiene las ventas del período con su estado de reconciliación, paginado.
 *
 * Combina ventas de productos y servicios, cada una con su reconciliación bancaria
 * asociada. Calcula diferencia por operación (monto venta - monto reconciliado).
 *
 * @param {string} tenantId - ID del tenant.
 * @param {{ gte: Date; lte: Date }} rango - Rango de fechas del período.
 * @param {string} modoContable - "CAJA" | "DEVENGO".
 * @param {number} page - Página actual (1-based).
 * @param {number} pageSize - Items por página.
 * @returns {Promise<VentasVsReconciliadoData>} Ventas paginadas con totales.
 */
export async function obtenerVentasVsReconciliado(
	tenantId: string,
	rango: { gte: Date; lte: Date },
	modoContable: string,
	page: number = 1,
	pageSize: number = 20,
): Promise<VentasVsReconciliadoData> {
	const skip = (page - 1) * pageSize;

	// ── Ventas de productos (físicas) ──
	const filtroVenta = {
		tenantId,
		createdAt: rango,
		deletedAt: null,
	};
	const [ventas, totalVentas] = await Promise.all([
		prisma.venta.findMany({
			where: filtroVenta,
			include: {
				VentaServicios: {
					select: { cuentaPorCobrar: { select: { estado: true } } },
				},
				factura: {
					select: { cuentaPorCobrar: { select: { estado: true } } },
				},
				reconciliaciones: {
					select: {
						monto: true,
						montoConvertido: true,
						fechaReconciliacion: true,
						moneda: true,
					},
						orderBy: { fechaReconciliacion: "desc" },
				},
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.venta.count({ where: filtroVenta }),
	]);

	// ── Ventas de servicios ──
	// VS con ventaId ya están contabilizadas dentro de la Venta vinculada:
	// se excluyen para evitar duplicar ingresos de ofertas mixtas.
	const filtroServicio = { tenantId, createdAt: rango, ventaId: null };
	const [ventasServicios, totalServicios] = await Promise.all([
		prisma.ventaServicios.findMany({
			where: filtroServicio,
			include: {
				cuentaPorCobrar: { select: { estado: true } },
				factura: {
					select: { cuentaPorCobrar: { select: { estado: true } } },
				},
				reconciliaciones: {
					select: {
						monto: true,
						montoConvertido: true,
						fechaReconciliacion: true,
						moneda: true,
					},
						orderBy: { fechaReconciliacion: "desc" },
				},
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.ventaServicios.count({ where: filtroServicio }),
	]);

	// ── Servicios contratados (CompraServicio) ──
	const filtroCompraServicio = { tenantId, fechaServicio: rango };
	const [comprasServicio, totalCompraServicio] = await Promise.all([
		prisma.compraServicio.findMany({
			where: filtroCompraServicio,
			orderBy: { fechaServicio: "desc" },
		}),
		prisma.compraServicio.count({ where: filtroCompraServicio }),
	]);

	// ── Costo de servicios vendidos (VentaServicios con costo > 0) ──
	// Estos aparecen como GASTO aparte de la línea SERVICIO (que muestra el total)
	const filtroVentaServicioCosto = {
		tenantId,
		createdAt: rango,
		costo: { gt: 0 },
	};
	const [ventasServicioCosto, totalVentaServicioCosto] = await Promise.all([
		prisma.ventaServicios.findMany({
			where: filtroVentaServicioCosto,
			orderBy: { createdAt: "desc" },
		}),
		prisma.ventaServicios.count({ where: filtroVentaServicioCosto }),
	]);

	// ── Gastos de operación (GastosDE) ──
	const filtroGastosDE = { tenantId, createdAt: rango };
	const [gastosDE, totalGastosDE] = await Promise.all([
		prisma.gastosDE.findMany({
			where: filtroGastosDE,
			include: {
				cuentaPorPagar: { select: { estado: true } },
				reconciliaciones: {
					select: {
						monto: true,
						montoConvertido: true,
						fechaReconciliacion: true,
						moneda: true,
					},
						orderBy: { fechaReconciliacion: "desc" },
				},
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.gastosDE.count({ where: filtroGastosDE }),
	]);

	// ── Gastos de compras (GastoCompra) ──
	const filtroGastoCompra = { tenantId, fechaCompra: rango, deletedAt: null };
	const [gastosCompra, totalGastosCompra] = await Promise.all([
		prisma.gastoCompra.findMany({
			where: filtroGastoCompra,
			include: {
				cuentaPorPagar: { select: { estado: true } },
				reconciliaciones: {
					select: {
						monto: true,
						montoConvertido: true,
						fechaReconciliacion: true,
						moneda: true,
					},
						orderBy: { fechaReconciliacion: "desc" },
				},
			},
			orderBy: { fechaCompra: "desc" },
		}),
		prisma.gastoCompra.count({ where: filtroGastoCompra }),
	]);

	// Mapear a tipo unificado
	const mapVenta = (v: (typeof ventas)[number]): VentaVsReconciliadoItem => {
		const estadoCuenta =
			v.factura?.cuentaPorCobrar?.estado ??
			v.VentaServicios?.find((servicio) => servicio.cuentaPorCobrar?.estado)
				?.cuentaPorCobrar?.estado ??
			null;
		const monto = Number(v.total ?? 0);
		const reconciliacion = classifyReconciliation(
			monto, v.reconciliaciones, estadoCuenta, "CUENTA_POR_COBRAR",
		);
		const rec = v.reconciliaciones[0];
		return {
			id: v.ventaId,
			tipo: "VENTA",
			folio: v.ventaId.slice(0, 8),
			fecha: v.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: v.metodoPago,
			origen: null,
			...reconciliacion,
			fechaReconciliacion: rec?.fechaReconciliacion ?? null,
			estadoCuenta,
		};
	};

	const mapServicio = (
		vs: (typeof ventasServicios)[number],
	): VentaVsReconciliadoItem => {
		const estadoCuenta =
			vs.cuentaPorCobrar?.estado ?? vs.factura?.cuentaPorCobrar?.estado ?? null;
		const monto = Number(vs.total ?? 0);
		const reconciliacion = classifyReconciliation(
			monto, vs.reconciliaciones, estadoCuenta, "CUENTA_POR_COBRAR",
		);
		const rec = vs.reconciliaciones[0];
		return {
			id: vs.ventaServicioId,
			tipo: "SERVICIO",
			folio: vs.ventaServicioId.slice(0, 8),
			fecha: vs.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: null,
			...reconciliacion,
			fechaReconciliacion: rec?.fechaReconciliacion ?? null,
			estadoCuenta,
		};
	};

	const mapGastoDE = (
		g: (typeof gastosDE)[number],
	): VentaVsReconciliadoItem => {
		const estadoCuenta = g.cuentaPorPagar?.estado ?? null;
		const monto = Number(g.monto ?? 0);
		const reconciliacion = classifyReconciliation(
			monto, g.reconciliaciones, estadoCuenta, "CUENTA_POR_PAGAR",
		);
		const rec = g.reconciliaciones[0];
		return {
			id: g.gastosDEId,
			tipo: "GASTO",
			folio: g.numeroFactura ?? g.gastosDEId.slice(0, 8),
			fecha: g.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: g.proveedor ?? "Gasto DE",
			...reconciliacion,
			fechaReconciliacion: rec?.fechaReconciliacion ?? null,
			estadoCuenta,
		};
	};

	const mapGastoCompra = (
		g: (typeof gastosCompra)[number],
	): VentaVsReconciliadoItem => {
		const estadoCuenta = g.cuentaPorPagar?.estado ?? null;
		const monto = Number(g.total ?? 0);
		const reconciliacion = classifyReconciliation(
			monto, g.reconciliaciones, estadoCuenta, "CUENTA_POR_PAGAR",
		);
		const rec = g.reconciliaciones[0];
		return {
			id: g.gastoCompraId,
			tipo: "GASTO",
			folio: g.numeroFactura ?? g.gastoCompraId.slice(0, 8),
			fecha: g.fechaCompra ?? g.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: "Compra",
			...reconciliacion,
			fechaReconciliacion: rec?.fechaReconciliacion ?? null,
			estadoCuenta,
		};
	};

	const mapCompraServicio = (
		g: (typeof comprasServicio)[number],
	): VentaVsReconciliadoItem => {
		const recData = montoReconciliadoCS.get(g.compraServicioId);
		const monto = Number(g.total ?? 0);
		const reconciliacion = classifyReconciliation(
			monto,
			recData ? [{ monto: recData.monto }] : [],
			g.estado ?? null,
			"CUENTA_POR_PAGAR",
		);
		return {
			id: g.compraServicioId,
			tipo: "GASTO",
			folio: g.numeroFactura ?? g.compraServicioId.slice(0, 8),
			fecha: g.fechaServicio ?? g.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: "Servicio Contratado",
			...reconciliacion,
			fechaReconciliacion: recData?.fecha ?? null,
			estadoCuenta: g.estado ?? null,
		};
	};

	const mapVentaServicioCosto = (
		vs: (typeof ventasServicioCosto)[number],
	): VentaVsReconciliadoItem => {
		const recData = montoReconciliadoVS.get(vs.ventaServicioId);
		const monto = Number(vs.costo ?? 0) * Number(vs.cantidad ?? 1);
		const reconciliacion = classifyReconciliation(
			monto,
			recData ? [{ monto: recData.monto }] : [],
			null,
			"CUENTA_POR_PAGAR",
		);
		return {
			id: `costo-${vs.ventaServicioId}`,
			tipo: "GASTO",
			folio: vs.ventaServicioId.slice(0, 8),
			fecha: vs.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: "Costo de Servicio Vendido",
			...reconciliacion,
			fechaReconciliacion: recData?.fecha ?? null,
		};
	};

	const allItems = [
		...ventas.map(mapVenta),
		...ventasServicios.map(mapServicio),
		...gastosDE.map(mapGastoDE),
		...gastosCompra.map(mapGastoCompra),
		...comprasServicio.map(mapCompraServicio),
		...ventasServicioCosto.map(mapVentaServicioCosto),
	].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

	// Paginar DESPUÉS de combinar — respeta pageSize
	const totalCount = allItems.length;
	const items = allItems.slice(skip, skip + pageSize);

	const reconciliadas = allItems.filter((i) => i.estaReconciliado).length;

	const gastosItems = allItems.filter((i) => i.tipo === "GASTO");
	const gastosReconciliados = gastosItems.filter(
		(i) => i.estaReconciliado,
	).length;

	// ── Items antiguos sin reconciliar (períodos anteriores) ──
	const LIMITE_ANTIGUOS = 100;
	const rangoAntiguos = { lt: rango.gte };

	const [
		ventasAntiguas,
		serviciosAntiguos,
		gastosDEAntiguos,
		gastosCompraAntiguos,
		comprasServicioAntiguos,
		ventasServicioCostoAntiguos,
	] = await Promise.all([
		prisma.venta.findMany({
			where: {
				tenantId,
				createdAt: rangoAntiguos,
				deletedAt: null,
			},
			include: {
				VentaServicios: {
					select: { cuentaPorCobrar: { select: { estado: true } } },
				},
				factura: {
					select: { cuentaPorCobrar: { select: { estado: true } } },
				},
				reconciliaciones: {
					select: {
						monto: true,
						montoConvertido: true,
						fechaReconciliacion: true,
					},
						orderBy: { fechaReconciliacion: "desc" },
				},
			},
			orderBy: { createdAt: "desc" },
			take: LIMITE_ANTIGUOS,
		}),
		prisma.ventaServicios.findMany({
			where: {
				tenantId,
				createdAt: rangoAntiguos,
			},
			include: {
				cuentaPorCobrar: { select: { estado: true } },
				factura: {
					select: { cuentaPorCobrar: { select: { estado: true } } },
				},
				reconciliaciones: {
					select: {
						monto: true,
						montoConvertido: true,
						fechaReconciliacion: true,
					},
						orderBy: { fechaReconciliacion: "desc" },
				},
			},
			orderBy: { createdAt: "desc" },
			take: LIMITE_ANTIGUOS,
		}),
		prisma.gastosDE.findMany({
			where: {
				tenantId,
				createdAt: rangoAntiguos,
				estado: 'APROBADO', // B-04
			},
			include: {
				cuentaPorPagar: { select: { estado: true } },
				reconciliaciones: {
					select: {
						monto: true,
						montoConvertido: true,
						fechaReconciliacion: true,
					},
						orderBy: { fechaReconciliacion: "desc" },
				},
			},
			orderBy: { createdAt: "desc" },
			take: LIMITE_ANTIGUOS,
		}),
		prisma.gastoCompra.findMany({
			where: {
				tenantId,
				fechaCompra: rangoAntiguos,
				deletedAt: null,
			},
			include: {
				cuentaPorPagar: { select: { estado: true } },
				reconciliaciones: {
					select: {
						monto: true,
						montoConvertido: true,
						fechaReconciliacion: true,
					},
						orderBy: { fechaReconciliacion: "desc" },
				},
			},
			orderBy: { fechaCompra: "desc" },
			take: LIMITE_ANTIGUOS,
		}),
		prisma.compraServicio.findMany({
			where: {
				tenantId,
				fechaServicio: rangoAntiguos,
			},
			orderBy: { fechaServicio: "desc" },
			take: LIMITE_ANTIGUOS,
		}),
		prisma.ventaServicios.findMany({
			where: {
				tenantId,
				createdAt: rangoAntiguos,
				costo: { gt: 0 },
			},
			orderBy: { createdAt: "desc" },
			take: LIMITE_ANTIGUOS,
		}),
	]);

	const compraServicioIds = [
		...comprasServicio.map((row) => row.compraServicioId),
		...comprasServicioAntiguos.map((row) => row.compraServicioId),
	];
	const ventaServicioCostoIds = [
		...ventasServicioCosto.map((row) => row.ventaServicioId),
		...ventasServicioCostoAntiguos.map((row) => row.ventaServicioId),
	];
	const [reconciliadosCompraServicio, reconciliadosVentaServicio] = await Promise.all([
		prisma.reconciliacionGasto.findMany({
			where: { tenantId, tipoGasto: "servicio", referenciaId: { in: compraServicioIds } },
			select: {
				referenciaId: true,
				monto: true,
				montoConvertido: true,
				fechaReconciliacion: true,
			},
			orderBy: { fechaReconciliacion: "desc" },
		}),
		prisma.reconciliacionGasto.findMany({
			where: {
				tenantId,
				tipoGasto: "venta_servicio",
				referenciaId: { in: ventaServicioCostoIds },
			},
			select: {
				referenciaId: true,
				monto: true,
				montoConvertido: true,
				fechaReconciliacion: true,
			},
			orderBy: { fechaReconciliacion: "desc" },
		}),
	]);
	const montoReconciliadoCS = new Map<string, { monto: number; fecha: Date | null }>();
	for (const reconciliation of reconciliadosCompraServicio) {
		if (!reconciliation.referenciaId) continue;
		const previous = montoReconciliadoCS.get(reconciliation.referenciaId);
		montoReconciliadoCS.set(reconciliation.referenciaId, {
			monto:
				(previous?.monto ?? 0) +
				Number(reconciliation.montoConvertido ?? reconciliation.monto ?? 0),
			fecha: previous?.fecha ?? reconciliation.fechaReconciliacion ?? null,
		});
	}
	const montoReconciliadoVS = new Map<string, { monto: number; fecha: Date | null }>();
	for (const reconciliation of reconciliadosVentaServicio) {
		if (!reconciliation.referenciaId) continue;
		const previous = montoReconciliadoVS.get(reconciliation.referenciaId);
		montoReconciliadoVS.set(reconciliation.referenciaId, {
			monto:
				(previous?.monto ?? 0) +
				Number(reconciliation.montoConvertido ?? reconciliation.monto ?? 0),
			fecha: previous?.fecha ?? reconciliation.fechaReconciliacion ?? null,
		});
	}

	const mapVentaAntigua = (
		v: (typeof ventasAntiguas)[number],
	): VentaVsReconciliadoItem => {
		const estadoCuenta =
			v.factura?.cuentaPorCobrar?.estado ??
			v.VentaServicios?.find((servicio) => servicio.cuentaPorCobrar?.estado)
				?.cuentaPorCobrar?.estado ??
			null;
		const monto = Number(v.total ?? 0);
		const reconciliacion = classifyReconciliation(
			monto, v.reconciliaciones, estadoCuenta, "CUENTA_POR_COBRAR",
		);
		const rec = v.reconciliaciones[0];
		return {
			id: v.ventaId,
			tipo: "VENTA",
			folio: v.ventaId.slice(0, 8),
			fecha: v.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: v.metodoPago,
			origen: null,
			...reconciliacion,
			fechaReconciliacion: rec?.fechaReconciliacion ?? null,
			estadoCuenta,
		};
	};

	const mapServicioAntiguo = (
		vs: (typeof serviciosAntiguos)[number],
	): VentaVsReconciliadoItem => {
		const estadoCuenta =
			vs.cuentaPorCobrar?.estado ?? vs.factura?.cuentaPorCobrar?.estado ?? null;
		const monto = Number(vs.total ?? 0);
		const reconciliacion = classifyReconciliation(
			monto, vs.reconciliaciones, estadoCuenta, "CUENTA_POR_COBRAR",
		);
		const rec = vs.reconciliaciones[0];
		return {
			id: vs.ventaServicioId,
			tipo: "SERVICIO",
			folio: vs.ventaServicioId.slice(0, 8),
			fecha: vs.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: null,
			...reconciliacion,
			fechaReconciliacion: rec?.fechaReconciliacion ?? null,
			estadoCuenta,
		};
	};

	const mapGastoDEAntiguo = (
		g: (typeof gastosDEAntiguos)[number],
	): VentaVsReconciliadoItem => {
		const estadoCuenta = g.cuentaPorPagar?.estado ?? null;
		const monto = Number(g.monto ?? 0);
		const reconciliacion = classifyReconciliation(
			monto, g.reconciliaciones, estadoCuenta, "CUENTA_POR_PAGAR",
		);
		const rec = g.reconciliaciones[0];
		return {
			id: g.gastosDEId,
			tipo: "GASTO",
			folio: g.numeroFactura ?? g.gastosDEId.slice(0, 8),
			fecha: g.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: g.proveedor ?? "Gasto DE",
			...reconciliacion,
			fechaReconciliacion: rec?.fechaReconciliacion ?? null,
			estadoCuenta,
		};
	};

	const mapGastoCompraAntiguo = (
		g: (typeof gastosCompraAntiguos)[number],
	): VentaVsReconciliadoItem => {
		const estadoCuenta = g.cuentaPorPagar?.estado ?? null;
		const monto = Number(g.total ?? 0);
		const reconciliacion = classifyReconciliation(
			monto, g.reconciliaciones, estadoCuenta, "CUENTA_POR_PAGAR",
		);
		const rec = g.reconciliaciones[0];
		return {
			id: g.gastoCompraId,
			tipo: "GASTO",
			folio: g.numeroFactura ?? g.gastoCompraId.slice(0, 8),
			fecha: g.fechaCompra ?? g.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: "Compra",
			...reconciliacion,
			fechaReconciliacion: rec?.fechaReconciliacion ?? null,
			estadoCuenta,
		};
	};

	const mapCompraServicioAntiguo = (
		g: (typeof comprasServicioAntiguos)[number],
	): VentaVsReconciliadoItem => {
		const recData = montoReconciliadoCS.get(g.compraServicioId);
		const monto = Number(g.total ?? 0);
		const reconciliacion = classifyReconciliation(
			monto, recData ? [{ monto: recData.monto }] : [], g.estado ?? null, "CUENTA_POR_PAGAR",
		);
		return {
			id: g.compraServicioId,
			tipo: "GASTO",
			folio: g.numeroFactura ?? g.compraServicioId.slice(0, 8),
			fecha: g.fechaServicio ?? g.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: "Servicio Contratado",
			...reconciliacion,
			fechaReconciliacion: recData?.fecha ?? null,
			estadoCuenta: g.estado ?? null,
		};
	};

	const mapVentaServicioCostoAntiguo = (
		vs: (typeof ventasServicioCostoAntiguos)[number],
	): VentaVsReconciliadoItem => {
		const recData = montoReconciliadoVS.get(vs.ventaServicioId);
		const monto = Number(vs.costo ?? 0) * Number(vs.cantidad ?? 1);
		const reconciliacion = classifyReconciliation(
			monto * Number(vs.cantidad ?? 1),
			recData ? [{ monto: recData.monto }] : [],
			null,
			"CUENTA_POR_PAGAR",
		);
		return {
			id: `costo-${vs.ventaServicioId}`,
			tipo: "GASTO",
			folio: vs.ventaServicioId.slice(0, 8),
			fecha: vs.createdAt,
			monto,
			moneda: "CUP",
			metodoPago: null,
			origen: "Costo de Servicio Vendido",
			...reconciliacion,
			fechaReconciliacion: recData?.fecha ?? null,
		};
	};

	const itemsAntiguos = [
		...ventasAntiguas.map(mapVentaAntigua),
		...serviciosAntiguos.map(mapServicioAntiguo),
		...gastosDEAntiguos.map(mapGastoDEAntiguo),
		...gastosCompraAntiguos.map(mapGastoCompraAntiguo),
		...comprasServicioAntiguos.map(mapCompraServicioAntiguo),
		...ventasServicioCostoAntiguos.map(mapVentaServicioCostoAntiguo),
	].filter((item) => !item.estaReconciliado)
		.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

	return {
		items,
		itemsAntiguos,
		totales: {
			totalVentas: round2(items.reduce((s, i) => s + i.monto, 0)),
			totalReconciliado: round2(
				items.reduce((s, i) => s + (i.montoReconciliado ?? 0), 0),
			),
			diferencia: round2(
				items.reduce((s, i) => s + (i.monto - (i.montoReconciliado ?? 0)), 0),
			),
			cantidadVentas: totalCount,
			cantidadReconciliadas: reconciliadas,
			cantidadPendientes: totalCount - reconciliadas,
			totalGastos: round2(gastosItems.reduce((s, i) => s + i.monto, 0)),
			cantidadGastos: gastosItems.length,
			cantidadGastosReconciliados: gastosReconciliados,
			cantidadGastosPendientes: gastosItems.length - gastosReconciliados,
		},
		totalPages: Math.ceil(totalCount / pageSize),
		page,
	};
}

/**
 * @description Obtiene el resumen diario del período con agregaciones por día.
 *
 * Agrupa ventas (ingresos) y gastos (egresos) por día fiscal.
 * Para cada día retorna totales y desglose por tipo de operación.
 * El desglose detallado solo se incluye si el período tiene <= 31 días.
 *
 * @param {string} tenantId - ID del tenant.
 * @param {{ gte: Date; lte: Date }} rango - Rango de fechas del período.
 * @param {string} modoContable - "CAJA" | "DEVENGO".
 * @returns {Promise<ResumenDiarioItem[]>} Array con un item por día.
 */
export async function obtenerResumenDiario(
	tenantId: string,
	rango: { gte: Date; lte: Date },
	modoContable: string,
): Promise<ResumenDiarioItem[]> {
	const diasEnPeriodo = Math.ceil(
		(rango.lte.getTime() - rango.gte.getTime()) / (1000 * 60 * 60 * 24),
	);
	const incluirDesglose = diasEnPeriodo <= 31;
	const gastoField = fieldReconciliacion(modoContable);

	// Traer todas las ventas del período
	const ventas = await prisma.venta.findMany({
		where: { tenantId, createdAt: rango, deletedAt: null },
		select: { createdAt: true, total: true },
	});

	const servicios = await prisma.ventaServicios.findMany({
		where: { tenantId, createdAt: rango },
		select: { createdAt: true, total: true },
	});

	// Traer gastos según modo contable
	const gastos = await prisma.reconciliacionGasto.findMany({
		where: {
			tenantId,
			[gastoField]: rango,
		},
		select: { [gastoField]: true, montoConvertido: true, tipoGasto: true },
	});

	// Agrupar por fecha (YYYY-MM-DD)
	const diasMap = new Map<
		string,
		{
			ingresos: number;
			egresos: number;
			cantOps: number;
			desglose: Map<string, { monto: number; cantidad: number }>;
		}
	>();

	const fmt = (d: Date) => d.toISOString().slice(0, 10);

	for (const v of ventas) {
		const key = fmt(v.createdAt);
		if (!diasMap.has(key))
			diasMap.set(key, {
				ingresos: 0,
				egresos: 0,
				cantOps: 0,
				desglose: new Map(),
			});
		const d = diasMap.get(key)!;
		const monto = Number(v.total ?? 0);
		d.ingresos += monto;
		d.cantOps++;
		if (incluirDesglose) {
			const g = d.desglose.get("VENTA") ?? { monto: 0, cantidad: 0 };
			g.monto += monto;
			g.cantidad++;
			d.desglose.set("VENTA", g);
		}
	}

	for (const vs of servicios) {
		const key = fmt(vs.createdAt);
		if (!diasMap.has(key))
			diasMap.set(key, {
				ingresos: 0,
				egresos: 0,
				cantOps: 0,
				desglose: new Map(),
			});
		const d = diasMap.get(key)!;
		const monto = Number(vs.total ?? 0);
		d.ingresos += monto;
		d.cantOps++;
		if (incluirDesglose) {
			const g = d.desglose.get("SERVICIO") ?? { monto: 0, cantidad: 0 };
			g.monto += monto;
			g.cantidad++;
			d.desglose.set("SERVICIO", g);
		}
	}

	for (const g of gastos) {
		const fecha = g[gastoField] as Date;
		const key = fmt(fecha);
		if (!diasMap.has(key))
			diasMap.set(key, {
				ingresos: 0,
				egresos: 0,
				cantOps: 0,
				desglose: new Map(),
			});
		const d = diasMap.get(key)!;
		const monto = Number(g.montoConvertido ?? 0);
		d.egresos += monto;
		d.cantOps++;
		if (incluirDesglose) {
			const t = g.tipoGasto ?? "GASTO";
			const g2 = d.desglose.get(t) ?? { monto: 0, cantidad: 0 };
			g2.monto += monto;
			g2.cantidad++;
			d.desglose.set(t, g2);
		}
	}

	// Convertir a array ordenado descendente
	const result: ResumenDiarioItem[] = Array.from(diasMap.entries())
		.map(([fecha, d]) => ({
			fecha,
			totalIngresos: round2(d.ingresos),
			totalEgresos: round2(d.egresos),
			neto: round2(d.ingresos - d.egresos),
			cantidadOperaciones: d.cantOps,
			desglose: incluirDesglose
				? Array.from(d.desglose.entries()).map(([tipo, v]) => ({
						tipo,
						monto: round2(v.monto),
						cantidad: v.cantidad,
					}))
				: [],
		}))
		.sort((a, b) => b.fecha.localeCompare(a.fecha));

	return result;
}

/**
 * @description Obtiene las operaciones del período, paginadas y filtrables por tipo.
 *
 * Combina en un listado unificado: ventas, servicios, gastos, transferencias,
 * ajustes, inyecciones de capital, pagos de deuda y préstamos.
 *
 * @param {string} tenantId - ID del tenant.
 * @param {{ gte: Date; lte: Date }} rango - Rango de fechas del período.
 * @param {string} modoContable - "CAJA" | "DEVENGO".
 * @param {number} page - Página actual (1-based).
 * @param {number} pageSize - Items por página.
 * @param {string} filtro - Filtro por tipo de operación ('todas' | 'venta' | ...).
 * @returns {Promise<OperacionesData>} Operaciones paginadas.
 */
export async function obtenerOperacionesPeriodo(
	tenantId: string,
	rango: { gte: Date; lte: Date },
	modoContable: string,
	page: number = 1,
	pageSize: number = 20,
	filtro: string = "todas",
): Promise<OperacionesData> {
	// Recolectar todas las operaciones en paralelo
	const promises: Array<Promise<OperacionItem[]>> = [];

	if (filtro === "todas" || filtro === "venta") {
		promises.push(
			prisma.venta
				.findMany({
					where: { tenantId, createdAt: rango, deletedAt: null },
					select: {
						ventaId: true,
						createdAt: true,
						total: true,
						metodoPago: true,
					},
				})
				.then((rows) =>
					rows.map((r) => ({
						id: r.ventaId,
						tipo: "VENTA" as const,
						descripcion: `Venta ${r.metodoPago ?? "contado"}`,
						fecha: r.createdAt,
						monto: Number(r.total ?? 0),
						moneda: "CUP",
						referencia: r.ventaId.slice(0, 8),
						cuentaId: null,
						cuentaNombre: null,
					})),
				),
		);
	}

	if (filtro === "todas" || filtro === "servicio") {
		promises.push(
			prisma.ventaServicios
				.findMany({
					where: { tenantId, createdAt: rango },
					select: {
						ventaServicioId: true,
						createdAt: true,
						total: true,
						observaciones: true,
					},
				})
				.then((rows) =>
					rows.map((r) => ({
						id: r.ventaServicioId,
						tipo: "SERVICIO" as const,
						descripcion: r.observaciones ?? "Venta de servicio",
						fecha: r.createdAt,
						monto: Number(r.total ?? 0),
						moneda: "CUP",
						referencia: r.ventaServicioId.slice(0, 8),
						cuentaId: null,
						cuentaNombre: null,
					})),
				),
		);
	}

	if (filtro === "todas" || filtro === "gasto") {
		const gf = fieldReconciliacion(modoContable);
		promises.push(
			prisma.reconciliacionGasto
				.findMany({
					where: { tenantId, [gf]: rango },
					select: {
						reconciliacionId: true,
						[gf]: true,
						montoConvertido: true,
						moneda: true,
						descripcion: true,
						tipoGasto: true,
						cuentaId: true,
						cuentaBancaria: { select: { nombreBanco: true } },
					},
				})
				.then((rows) =>
					rows.map((r) => ({
						id: r.reconciliacionId,
						tipo: "GASTO" as const,
						descripcion: r.descripcion || r.tipoGasto || "Gasto",
						fecha: (r as any)[gf] as Date,
						monto: Number(r.montoConvertido ?? 0),
						moneda: r.moneda,
						referencia: null,
						cuentaId: r.cuentaId,
						cuentaNombre: (r as any).cuentaBancaria?.nombreBanco ?? null,
					})),
				),
		);
	}

	if (filtro === "todas" || filtro === "transferencia") {
		promises.push(
			prisma.transferenciaBancaria
				.findMany({
					where: { tenantId, fechaTransferencia: rango },
					select: {
						transferenciaId: true,
						fechaTransferencia: true,
						montoOrigen: true,
						monedaOrigen: true,
						motivo: true,
						numeroComprobante: true,
					},
				})
				.then((rows) =>
					rows.map((r) => ({
						id: r.transferenciaId,
						tipo: "TRANSFERENCIA" as const,
						descripcion: r.motivo || "Transferencia",
						fecha: r.fechaTransferencia,
						monto: Number(r.montoOrigen ?? 0),
						moneda: r.monedaOrigen,
						referencia: r.numeroComprobante,
						cuentaId: null,
						cuentaNombre: null,
					})),
				),
		);
	}

	if (filtro === "todas" || filtro === "ajuste") {
		promises.push(
			prisma.ajusteBancario
				.findMany({
					where: { tenantId, createdAt: rango },
					select: {
						ajusteId: true,
						createdAt: true,
						monto: true,
						moneda: true,
						descripcion: true,
						tipo: true,
						cuentaId: true,
						cuentaBancaria: { select: { nombreBanco: true } },
					},
				})
				.then((rows) =>
					rows.map((r) => ({
						id: r.ajusteId,
						tipo: "AJUSTE" as const,
						descripcion: `${r.tipo}: ${r.descripcion}`,
						fecha: r.createdAt,
						monto: Number(r.monto ?? 0),
						moneda: r.moneda,
						referencia: null,
						cuentaId: r.cuentaId,
						cuentaNombre: r.cuentaBancaria?.nombreBanco ?? null,
					})),
				),
		);
	}

	if (filtro === "todas" || filtro === "capital") {
		promises.push(
			prisma.inyeccionCapital
				.findMany({
					where: { cuentaBancaria: { tenantId }, createdAt: rango },
					select: {
						id: true,
						createdAt: true,
						montoRecibido: true,
						moneda: true,
						cuentaId: true,
						cuentaBancaria: { select: { nombreBanco: true } },
					},
				})
				.then((rows) =>
					rows.map((r) => ({
						id: r.id,
						tipo: "CAPITAL" as const,
						descripcion: "Inyección de capital",
						fecha: r.createdAt,
						monto: Number(r.montoRecibido ?? 0),
						moneda: r.moneda,
						referencia: null,
						cuentaId: r.cuentaId,
						cuentaNombre: r.cuentaBancaria?.nombreBanco ?? null,
					})),
				),
		);
	}

	if (filtro === "todas" || filtro === "pago_deuda") {
		promises.push(
			prisma.pagoDeuda
				.findMany({
					where: { cuentaBancaria: { tenantId }, fechaPago: rango },
					select: {
						id: true,
						fechaPago: true,
						montoPagado: true,
						cuentaBancaria: { select: { moneda: true, nombreBanco: true } },
						cuentaId: true,
					},
				})
				.then((rows) =>
					rows.map((r) => ({
						id: r.id,
						tipo: "PAGO_DEUDA" as const,
						descripcion: "Pago de deuda",
						fecha: r.fechaPago,
						monto: Number(r.montoPagado ?? 0),
						moneda: r.cuentaBancaria?.moneda ?? "CUP",
						referencia: null,
						cuentaId: r.cuentaId,
						cuentaNombre: r.cuentaBancaria?.nombreBanco ?? null,
					})),
				),
		);
	}

	// Ejecutar todas las queries en paralelo
	const resultados = await Promise.all(promises);

	// Unir, ordenar y paginar
	const todos = resultados
		.flat()
		.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
	const totalCount = todos.length;
	const totalPages = Math.ceil(totalCount / pageSize);
	const paginados = todos.slice((page - 1) * pageSize, page * pageSize);

	return {
		items: paginados,
		totalPages,
		page,
		totalCount,
	};
}

/**
 * @description Obtiene las operaciones detalladas de un día específico para el acordeón diario.
 *
 * @param {string} tenantId - ID del tenant.
 * @param {string} fechaStr - Fecha en formato "YYYY-MM-DD".
 * @param {string} modoContable - "CAJA" | "DEVENGO".
 * @returns {Promise<OperacionItem[]>} Operaciones del día.
 */
export async function obtenerOperacionesDelDia(
	tenantId: string,
	fechaStr: string,
	modoContable: string,
): Promise<OperacionItem[]> {
	const inicio = new Date(`${fechaStr}T00:00:00.000Z`);
	const fin = new Date(`${fechaStr}T23:59:59.999Z`);
	const rango = { gte: inicio, lte: fin };

	const result = await obtenerOperacionesPeriodo(
		tenantId,
		rango,
		modoContable,
		1,
		500,
		"todas",
	);

	return result.items;
}
