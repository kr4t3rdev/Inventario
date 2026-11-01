/**
 * @description Abre un período contable en producción con el flujo oficial de
 * apertura manual con cuadre aprobado (solicitud -> aprobación -> apertura),
 * ejecutando las Server Actions reales de la aplicación.
 *
 * La derivación de las líneas usa los saldos operativos del tenant:
 * bancos (por tipo y moneda), inventario (FIFO con capas de compra),
 * CxC, CxP, inyecciones de capital y el residual acumulado en resultados.
 * El control de dos fases (solicitud PENDIENTE + aprobación con hash) y la
 * verificación de partida doble las aplica el propio dominio.
 *
 * Requisitos previos por tenant: politica contable (moneda funcional) y un
 * manager activo con permiso `financiero.apertura.aprobar`. El script siembra
 * el plan de cuentas y los diarios del tenant si faltan (operacion idempotente).
 *
 * Uso:
 *   DATABASE_URL=<url publica de produccion> JWT_SECRET=<secreto> \
 *   node --import tsx --import ./scripts/ops/runtime/register.mjs \
 *   scripts/ops/open-accounting-period-production.ts --tenant <tenantId> [--dry-run]
 */
import jwt from 'jsonwebtoken';
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma';
import { Prisma } from '@/generated/prisma';
import {
	ACTIVE_PAYABLE_STATES,
	ACTIVE_RECEIVABLE_STATES,
} from '@/features/contabilidad/domain/balance-calculator';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';

/** Codigos del plan contable estandar (src/features/contabilidad-formal/lib/plan-default.ts). */
const CUENTAS = {
	CAJA: '1.1.01',
	BANCOS: '1.1.02',
	CXC_CLIENTES: '1.2.01',
	PRESTAMOS_OTORGADOS: '1.2.02',
	INVENTARIOS: '1.3.01',
	CXP_PROVEEDORES: '2.1.01',
	DEUDAS_RECIBIDAS: '2.1.02',
	CAPITAL_SOCIAL: '3.1',
	RESULTADOS_ACUMULADOS: '3.2',
} as const;

const PRECISION = 4;

interface LineaBruta {
	cuentaCodigo: string;
	moneda: string;
	monto: Prisma.Decimal;
	lado: 'DEBE' | 'HABER';
	concepto: string;
}

interface LineaApertura {
	cuentaCodigo: string;
	moneda: string;
	debito: string;
	credito: string;
	concepto: string;
}

interface Opciones {
	tenantId: string;
	dryRun: boolean;
	fechaInicio: Date;
	fechaFin: Date;
	periodo: string;
}

/**
 * @description Parsea los argumentos de linea de comandos del script.
 * @param {string[]} argv - Argumentos sin el nombre del ejecutable.
 * @returns {Opciones} Opciones normalizadas para la ejecucion.
 */
function parseArgs(argv: string[]): Opciones {
	const args = argv.slice(2);
	const tenantIndex = args.indexOf('--tenant');
	const tenantId = tenantIndex >= 0 ? args[tenantIndex + 1] : undefined;
	if (!tenantId) {
		throw new Error('Falta --tenant <tenantId>');
	}
	const dryRun = args.includes('--dry-run');
	const periodoIndex = args.indexOf('--periodo');
	const periodo = periodoIndex >= 0 ? (args[periodoIndex + 1] ?? '2026-10') : '2026-10';
	if (!/^\d{4}-\d{2}$/.test(periodo)) {
		throw new Error('--periodo debe tener formato YYYY-MM');
	}
	const [anio, mes] = periodo.split('-').map((parte) => Number(parte));
	const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
	const fechaInicio = new Date(Date.UTC(anio, mes - 1, 1, 0, 0, 0, 0));
	const fechaFin = new Date(Date.UTC(anio, mes - 1, ultimoDia, 23, 59, 59, 999));
	return { tenantId, dryRun, fechaInicio, fechaFin, periodo };
}

/**
 * @description Convierte un Decimal a cadena con la precision del libro mayor.
 * @param {Prisma.Decimal} valor - Importe a formatear.
 * @returns {string} Importe con 4 decimales.
 */
function fmt(valor: Prisma.Decimal): string {
	return valor.toDecimalPlaces(PRECISION).toString();
}

/**
 * @description Calcula el valor del inventario con la misma regla del dominio:
 * capas FIFO de compra y, para el remanente, el costo actual del producto.
 * @param {string} tenantId - Tenant propietario del inventario.
 * @returns {Promise<{ total: Prisma.Decimal; detalle: string[] }>} Valor total y detalle por producto.
 */
async function valorarInventario(
	tenantId: string,
): Promise<{ total: Prisma.Decimal; detalle: string[] }> {
	const ubicaciones = await prisma.stockUbicacion.findMany({
		where: { tenantId, cantidad: { gt: 0 } },
		select: {
			productoId: true,
			cantidad: true,
			producto: { select: { nombre: true, precioCosto: true } },
		},
	});
	const capas = await prisma.compraDocumentoItem.findMany({
		where: { tenantId, compraDocumento: { deletedAt: null } },
		orderBy: { createdAt: 'asc' },
		select: {
			productoId: true,
			cantidad: true,
			precioUnitario: true,
			allocations: { select: { cantidad: true } },
		},
	});

	const capasPorProducto = new Map<string, Array<{ cantidad: Prisma.Decimal; costo: Prisma.Decimal }>>();
	for (const capa of capas) {
		const asignado = capa.allocations.reduce(
			(total, allocacion) => total + Number(allocacion.cantidad),
			0,
		);
		const remanente = Math.max(0, Number(capa.cantidad) - asignado);
		if (remanente <= 0) continue;
		const lista = capasPorProducto.get(capa.productoId) ?? [];
		lista.push({
			cantidad: new Prisma.Decimal(remanente),
			costo: new Prisma.Decimal(capa.precioUnitario),
		});
		capasPorProducto.set(capa.productoId, lista);
	}

	const cantidadPorProducto = new Map<string, Prisma.Decimal>();
	const costoReferencia = new Map<string, Prisma.Decimal>();
	const nombreProducto = new Map<string, string>();
	for (const ubicacion of ubicaciones) {
		cantidadPorProducto.set(
			ubicacion.productoId,
			(cantidadPorProducto.get(ubicacion.productoId) ?? new Prisma.Decimal(0)).plus(
				new Prisma.Decimal(ubicacion.cantidad),
			),
		);
		costoReferencia.set(
			ubicacion.productoId,
			new Prisma.Decimal(ubicacion.producto?.precioCosto ?? 0),
		);
		nombreProducto.set(ubicacion.productoId, ubicacion.producto?.nombre ?? ubicacion.productoId);
	}

	let total = new Prisma.Decimal(0);
	const detalle: string[] = [];
	for (const [productoId, cantidad] of cantidadPorProducto) {
		let restante = cantidad;
		let valor = new Prisma.Decimal(0);
		for (const capa of capasPorProducto.get(productoId) ?? []) {
			if (restante.lte(0)) break;
			const usado = Prisma.Decimal.min(restante, capa.cantidad);
			valor = valor.plus(usado.mul(capa.costo));
			restante = restante.minus(usado);
		}
		if (restante.gt(0)) {
			valor = valor.plus(restante.mul(costoReferencia.get(productoId) ?? new Prisma.Decimal(0)));
		}
		total = total.plus(valor);
		detalle.push(
			`${nombreProducto.get(productoId)}: ${cantidad.toString()} uds = ${fmt(valor)}`,
		);
	}
	return { total: total.toDecimalPlaces(PRECISION), detalle };
}

/**
 * @description Deriva las lineas de apertura desde los saldos operativos.
 * @param {string} tenantId - Tenant a derivar.
 * @param {string} monedaFuncional - Moneda funcional contable del tenant.
 * @param {Date} corte - Fecha de corte de la posicion (inicio del periodo).
 * @returns {Promise<{ lineas: LineaBruta[]; avisos: string[] }>} Lineas brutas y avisos de datos.
 */
async function derivarLineas(
	tenantId: string,
	monedaFuncional: string,
	corte: Date,
): Promise<{ lineas: LineaBruta[]; avisos: string[] }> {
	const lineas: LineaBruta[] = [];
	const avisos: string[] = [];

	// ── Bancos y efectivo ─────────────────────────────────────────────────────
	const bancos = await prisma.cuentaBancaria.findMany({
		where: { tenantId, isActive: true },
		select: {
			cuentaId: true,
			nombreBanco: true,
			tipoCuenta: true,
			saldo: true,
			moneda: true,
		},
	});
	const bancosPorCuenta = new Map<string, Prisma.Decimal>();
	for (const banco of bancos) {
		const saldo = new Prisma.Decimal(banco.saldo);
		if (!saldo.gt(0)) continue;
		const codigo =
			banco.tipoCuenta?.toUpperCase() === 'EFECTIVO' ? CUENTAS.CAJA : CUENTAS.BANCOS;
		const clave = `${codigo}|${(banco.moneda ?? monedaFuncional).toUpperCase()}`;
		bancosPorCuenta.set(
			clave,
			(bancosPorCuenta.get(clave) ?? new Prisma.Decimal(0)).plus(saldo),
		);
		avisos.push(
			`banco ${banco.nombreBanco} (${banco.tipoCuenta}) ${saldo.toString()} ${banco.moneda}`,
		);
	}

	// ── Inventario ────────────────────────────────────────────────────────────
	const inventario = await valorarInventario(tenantId);
	if (inventario.total.gt(0)) {
		lineas.push({
			cuentaCodigo: CUENTAS.INVENTARIOS,
			moneda: monedaFuncional,
			monto: inventario.total,
			lado: 'DEBE',
			concepto: `Inventario a costo (${inventario.detalle.length} productos)`,
		});
		for (const detalle of inventario.detalle) avisos.push(`inventario ${detalle}`);
	}

	// ── Cuentas por cobrar ────────────────────────────────────────────────────
	const cobros = await prisma.cuentaPorCobrar.findMany({
		where: { tenantId, estado: { in: [...ACTIVE_RECEIVABLE_STATES] } },
		select: {
			id: true,
			montoDeuda: true,
			montoPagado: true,
			prestamoCash: { select: { moneda: true } },
		},
	});
	let cxcClientes = new Prisma.Decimal(0);
	let cxcPrestamos = new Prisma.Decimal(0);
	for (const cobro of cobros) {
		const saldo = new Prisma.Decimal(cobro.montoDeuda).minus(new Prisma.Decimal(cobro.montoPagado));
		if (!saldo.gt(0)) continue;
		if (cobro.prestamoCash) {
			const monedaPrestamo = (cobro.prestamoCash.moneda ?? monedaFuncional).toUpperCase();
			if (monedaPrestamo !== monedaFuncional.toUpperCase()) {
				throw new Error(
					`El prestamo cash ${cobro.id} esta en ${monedaPrestamo} y requiere evidencia FX historica; no se deriva automaticamente.`,
				);
			}
			cxcPrestamos = cxcPrestamos.plus(saldo);
		} else {
			cxcClientes = cxcClientes.plus(saldo);
		}
	}
	if (cxcClientes.gt(0)) {
		lineas.push({
			cuentaCodigo: CUENTAS.CXC_CLIENTES,
			moneda: monedaFuncional,
			monto: cxcClientes,
			lado: 'DEBE',
			concepto: 'Clientes por ventas a credito',
		});
	}
	if (cxcPrestamos.gt(0)) {
		lineas.push({
			cuentaCodigo: CUENTAS.PRESTAMOS_OTORGADOS,
			moneda: monedaFuncional,
			monto: cxcPrestamos,
			lado: 'DEBE',
			concepto: 'Prestamos otorgados a clientes',
		});
	}

	// ── Cuentas por pagar ─────────────────────────────────────────────────────
	const pagos = await prisma.cuentaPorPagar.findMany({
		where: { tenantId, deletedAt: null, estado: { in: [...ACTIVE_PAYABLE_STATES] } },
		select: { cuentaPorPagarId: true, saldoPendiente: true, moneda: true },
	});
	let cxp = new Prisma.Decimal(0);
	for (const pago of pagos) {
		const moneda = (pago.moneda ?? monedaFuncional).toUpperCase();
		if (moneda !== monedaFuncional.toUpperCase()) {
			throw new Error(
				`La cuenta por pagar ${pago.cuentaPorPagarId} esta en ${moneda} y requiere evidencia FX historica; no se deriva automaticamente.`,
			);
		}
		cxp = cxp.plus(new Prisma.Decimal(pago.saldoPendiente));
	}
	if (cxp.gt(0)) {
		lineas.push({
			cuentaCodigo: CUENTAS.CXP_PROVEEDORES,
			moneda: monedaFuncional,
			monto: cxp,
			lado: 'HABER',
			concepto: 'Proveedores y cuentas por pagar',
		});
	}

	// ── Inyecciones de capital y deudas recibidas ─────────────────────────────
	const inyecciones = await prisma.inyeccionCapital.findMany({
		where: { cuentaBancaria: { tenantId }, fechaRegistro: { lte: corte } },
		select: {
			id: true,
			tipo: true,
			montoRecibido: true,
			saldoPendiente: true,
			moneda: true,
			estado: true,
		},
	});
	let capital = new Prisma.Decimal(0);
	let deudasRecibidas = new Prisma.Decimal(0);
	const inyeccionesPorCuenta = new Map<string, Prisma.Decimal>();
	for (const inyeccion of inyecciones) {
		const moneda = (inyeccion.moneda ?? monedaFuncional).toUpperCase();
		if (inyeccion.tipo === 'CAPITAL_SOCIAL') {
			capital = capital.plus(new Prisma.Decimal(inyeccion.montoRecibido));
		} else if (inyeccion.estado !== 'PAGADA') {
			deudasRecibidas = deudasRecibidas.plus(
				new Prisma.Decimal(inyeccion.saldoPendiente ?? inyeccion.montoRecibido),
			);
		} else {
			continue;
		}
		const codigo =
			inyeccion.tipo === 'CAPITAL_SOCIAL'
				? CUENTAS.CAPITAL_SOCIAL
				: CUENTAS.DEUDAS_RECIBIDAS;
		const clave = `${codigo}|${moneda}`;
		inyeccionesPorCuenta.set(
			clave,
			(inyeccionesPorCuenta.get(clave) ?? new Prisma.Decimal(0)).plus(
				new Prisma.Decimal(inyeccion.montoRecibido),
			),
		);
	}
	for (const [clave, monto] of inyeccionesPorCuenta) {
		const [cuentaCodigo, moneda] = clave.split('|');
		lineas.push({
			cuentaCodigo,
			moneda,
			monto: monto.toDecimalPlaces(PRECISION),
			lado: 'HABER',
			concepto:
				cuentaCodigo === CUENTAS.CAPITAL_SOCIAL ? 'Capital social' : 'Deudas recibidas',
		});
	}

	// ── Bancos (lineas por cuenta y moneda) ───────────────────────────────────
	for (const [clave, monto] of bancosPorCuenta) {
		const [cuentaCodigo, moneda] = clave.split('|');
		lineas.push({
			cuentaCodigo,
			moneda,
			monto: monto.toDecimalPlaces(PRECISION),
			lado: 'DEBE',
			concepto: cuentaCodigo === CUENTAS.CAJA ? 'Caja general' : 'Bancos',
		});
	}

	return { lineas, avisos };
}

/**
 * @description Convierte las lineas brutas en lineas de apertura balanceadas en
 * moneda funcional, usando el catalogo de tasas para las divisas y colocando
 * el residual en resultados acumulados.
 * @param {LineaBruta[]} lineas - Lineas brutas derivadas.
 * @param {string} monedaFuncional - Moneda funcional del tenant.
 * @returns {Promise<{ lineas: LineaApertura[]; avisos: string[] }>} Lineas de apertura y avisos.
 */
async function balancearLineas(
	lineas: LineaBruta[],
	monedaFuncional: string,
): Promise<{
	lineas: LineaApertura[];
	avisos: string[];
	totalDebeFuncional: Prisma.Decimal;
	totalHaberFuncional: Prisma.Decimal;
}> {
	const avisos: string[] = [];
	const valued: Array<LineaBruta & { funcional: Prisma.Decimal }> = [];
	let totalDebe = new Prisma.Decimal(0);
	let totalHaber = new Prisma.Decimal(0);

	for (const linea of lineas) {
		const moneda = linea.moneda.toUpperCase();
		let funcional: Prisma.Decimal;
		if (moneda === monedaFuncional.toUpperCase()) {
			funcional = linea.monto.toDecimalPlaces(PRECISION);
		} else {
			const tasa = await exchangeRateProvider.getRateAsOf({
				sourceCurrency: moneda,
				targetCurrency: monedaFuncional,
				boundaryAt: new Date(),
			});
			if (!tasa) {
				throw new Error(`No existe tasa canonica vigente para ${moneda} -> ${monedaFuncional}`);
			}
			funcional = linea.monto
				.mul(new Prisma.Decimal(tasa.tasa))
				.toDecimalPlaces(PRECISION);
			avisos.push(
				`conversion ${linea.concepto}: ${linea.monto.toString()} ${moneda} x ${tasa.tasa} (${tasa.tasaId}, ${tasa.fechaVigencia.toISOString().slice(0, 10)}) = ${fmt(funcional)} ${monedaFuncional}`,
			);
		}
		if (linea.lado === 'DEBE') totalDebe = totalDebe.plus(funcional);
		else totalHaber = totalHaber.plus(funcional);
		valued.push({ ...linea, funcional });
	}

	const residual = totalDebe.minus(totalHaber);
	if (!residual.isZero()) {
		valued.push({
			cuentaCodigo: CUENTAS.RESULTADOS_ACUMULADOS,
			moneda: monedaFuncional,
			monto: residual.abs(),
			lado: residual.gt(0) ? 'HABER' : 'DEBE',
			concepto:
				residual.gt(0)
					? 'Resultados acumulados (utilidad acumulada a la fecha de apertura)'
					: 'Resultados acumulados (perdida acumulada a la fecha de apertura)',
			funcional: residual.abs(),
		});
	}

	const lineasApertura: LineaApertura[] = valued.map((linea) => ({
		cuentaCodigo: linea.cuentaCodigo,
		moneda: linea.moneda,
		// El importe de la linea va en la moneda de la linea; la conversion a
		// moneda funcional la aplica el dominio con la evidencia FX del catalogo.
		debito: linea.lado === 'DEBE' ? fmt(linea.monto) : '0',
		credito: linea.lado === 'HABER' ? fmt(linea.monto) : '0',
		concepto: linea.concepto,
	}));

	return {
		lineas: lineasApertura,
		avisos,
		// El residual se acredita (utilidad) o debita (perdida) en resultados.
		totalDebeFuncional: totalDebe.plus(residual.lt(0) ? residual.abs() : new Prisma.Decimal(0)),
		totalHaberFuncional: totalHaber.plus(residual.gt(0) ? residual : new Prisma.Decimal(0)),
	};
}

/**
 * @description Extiende el timeout de las transacciones interactivas de Prisma
 * dentro de este proceso operativo.
 *
 * El default de Prisma (5s) es insuficiente para la transaccion de apertura
 * manual cuando la base de datos se alcanza a traves del proxy publico de
 * Railway (latencia alta). El parche solo afecta a este proceso: el codigo de
 * la aplicacion mantiene su timeout por defecto (ver el issue de robustez de
 * timeouts transaccionales).
 * @returns {Promise<void>} Resuelve cuando el parche queda aplicado.
 */
async function ampliarTimeoutTransacciones(): Promise<void> {
	const { prisma: appPrisma } = await import('@/lib/prisma');
	const original = appPrisma.$transaction.bind(appPrisma);
	(appPrisma as unknown as { $transaction: unknown }).$transaction = (
		arg1: unknown,
		arg2?: { timeout?: number; maxWait?: number },
	) => {
		if (typeof arg1 === 'function') {
			return original(
				arg1 as never,
				{ timeout: 180_000, maxWait: 30_000, ...(arg2 ?? {}) } as never,
			);
		}
		return original(arg1 as never);
	};
}

/**
 * @description Crea una sesion efimera equivalente a un login para el manager
 * del tenant y la elimina al finalizar.
 * @param {string} tenantId - Tenant del actor.
 * @returns {Promise<{ token: string; sessionId: string; userId: string }>} Datos de la sesion.
 */
async function crearSesionEphemera(
	tenantId: string,
): Promise<{ token: string; sessionId: string; userId: string }> {
	const secret = process.env.JWT_SECRET;
	if (!secret) throw new Error('JWT_SECRET es obligatoria');
	const membresia = await prisma.tenantMembership.findFirst({
		where: { tenantId, isActive: true },
		select: { userId: true, tenantRole: true, user: { select: { email: true } } },
	});
	if (!membresia) throw new Error(`El tenant ${tenantId} no tiene membresia activa`);
	const email = membresia.user?.email ?? '';
	const token = jwt.sign(
		{
			userId: membresia.userId,
			email,
			tenantId,
			tenantRole: membresia.tenantRole,
		},
		secret,
		{ expiresIn: '30m' },
	);
	const sesion = await prisma.userSession.create({
		data: {
			userId: membresia.userId,
			token,
			isActive: true,
			expiresAt: new Date(Date.now() + 30 * 60 * 1000),
			userAgent: 'ops-apertura-periodo',
		},
		select: { id: true },
	});
	return { token, sessionId: sesion.id, userId: membresia.userId };
}

/**
 * @description Verifica el estado contable resultante: periodo abierto que
 * cubre la fecha, asiento de apertura y partida doble.
 * @param {string} tenantId - Tenant verificado.
 * @param {Date} desde - Fecha de inicio del periodo buscado.
 * @returns {Promise<void>} Resuelve cuando la verificacion termina.
 */
async function verificarEstado(tenantId: string, desde: Date): Promise<void> {
	const periodos = await prisma.periodoContable.findMany({
		where: { tenantId, fechaInicio: { gte: desde }, estado: 'ABIERTO' },
		select: {
			periodoId: true,
			codigo: true,
			estado: true,
			fechaInicio: true,
			fechaFin: true,
			apertura: { select: { detalleJson: true } },
			asientos: {
				select: {
					asientoId: true,
					descripcion: true,
					fecha: true,
					origenTipo: true,
					lineas: {
						select: {
							orden: true,
							debe: true,
							haber: true,
							cuenta: { select: { codigo: true, nombre: true } },
						},
						orderBy: { orden: 'asc' },
					},
				},
			},
		},
	});
	console.log('\n-- verificacion --');
	if (periodos.length === 0) {
		console.log('sin periodos abiertos con fecha de inicio posterior al corte');
		return;
	}
	for (const periodo of periodos) {
		const detalle = periodo.apertura?.detalleJson as { asientoId?: string } | undefined;
		console.log(
			`periodo ${periodo.periodoId} ${periodo.codigo} ${periodo.estado} ${periodo.fechaInicio.toISOString().slice(0, 10)}..${periodo.fechaFin.toISOString().slice(0, 10)}`,
		);
		for (const asiento of periodo.asientos) {
			const totalDebe = asiento.lineas.reduce(
				(total, linea) => total.plus(new Prisma.Decimal(linea.debe)),
				new Prisma.Decimal(0),
			);
			const totalHaber = asiento.lineas.reduce(
				(total, linea) => total.plus(new Prisma.Decimal(linea.haber)),
				new Prisma.Decimal(0),
			);
			console.log(
				`  asiento ${asiento.asientoId} ${asiento.fecha.toISOString().slice(0, 10)} ${asiento.descripcion} (origen ${asiento.origenTipo}) debe=${fmt(totalDebe)} haber=${fmt(totalHaber)} lineas=${asiento.lineas.length}`,
			);
			for (const linea of asiento.lineas) {
				console.log(
					`    ${String(linea.orden).padStart(2, '0')} ${linea.cuenta.codigo} ${linea.cuenta.nombre} debe=${linea.debe} haber=${linea.haber}`,
				);
			}
		}
		console.log(`  apertura registrada con asiento ${detalle?.asientoId ?? 'n/d'}`);
	}
}

/**
 * @description Ejecuta el flujo completo de apertura manual para un tenant.
 * @param {Opciones} opciones - Opciones de ejecucion.
 * @returns {Promise<void>} Resuelve cuando el flujo termina.
 */
async function main(): Promise<void> {
	const opciones = parseArgs(process.argv);
	const { tenantId, dryRun, fechaInicio, fechaFin, periodo } = opciones;
	console.log(`\n=== Apertura manual de periodo: ${tenantId} ===`);
	console.log(
		`periodo: ${periodo} (${fechaInicio.toISOString().slice(0, 10)} .. ${fechaFin.toISOString().slice(0, 10)}) | modo: ${dryRun ? 'dry-run' : 'ejecucion'}`,
	);

	const policy = await prisma.tenantAccountingPolicy.findUnique({
		where: { tenantId },
		select: { functionalCurrencyCode: true },
	});
	if (!policy) {
		throw new Error(
			`El tenant ${tenantId} no tiene politica contable (moneda funcional). Provisionela antes de abrir el periodo.`,
		);
	}
	const monedaFuncional = policy.functionalCurrencyCode.trim().toUpperCase();
	console.log(`moneda funcional: ${monedaFuncional}`);

	const { lineas: brutas, avisos } = await derivarLineas(tenantId, monedaFuncional, fechaInicio);
	const { lineas, avisos: avisosFx, totalDebeFuncional, totalHaberFuncional } =
		await balancearLineas(brutas, monedaFuncional);
	console.log('\n-- avisos de datos --');
	for (const aviso of [...avisos, ...avisosFx]) console.log(`  ${aviso}`);
	console.log('\n-- lineas de apertura propuestas --');
	for (const linea of lineas) {
		console.log(
			`  ${linea.cuentaCodigo} ${linea.moneda} debe=${linea.debito} haber=${linea.credito}  (${linea.concepto})`,
		);
	}
	console.log(
		`  TOTAL (moneda funcional ${monedaFuncional}) debe=${fmt(totalDebeFuncional)} haber=${fmt(totalHaberFuncional)}`,
	);
	if (!totalDebeFuncional.equals(totalHaberFuncional)) {
		throw new Error('Las lineas propuestas no balancean; no se ejecuta la apertura.');
	}
	if (lineas.length < 2) {
		throw new Error('Se requieren al menos 2 lineas de apertura.');
	}

	if (dryRun) {
		console.log('\ndry-run: no se escribe nada.');
		return;
	}

	// ── Precondiciones: plan de cuentas y diarios ─────────────────────────────
	const cuentasAntes = await prisma.cuentaContable.count({ where: { tenantId } });
	if (cuentasAntes === 0) {
		console.log('\nsembrando plan de cuentas y diarios del tenant...');
		await prisma.$transaction(
			async (tx) => {
				await seedPlanContable(tx as never, tenantId);
			},
			{ timeout: 900_000, maxWait: 60_000 },
		);
		const cuentasDespues = await prisma.cuentaContable.count({ where: { tenantId } });
		const diarios = await prisma.diario.count({ where: { tenantId } });
		console.log(`plan de cuentas: ${cuentasAntes} -> ${cuentasDespues} cuentas | ${diarios} diarios`);
	}
	const diarioApertura = await prisma.diario.findFirst({
		where: { tenantId, tipo: 'APERTURA_CIERRE', activo: true },
		select: { diarioId: true, codigo: true },
	});
	if (!diarioApertura) {
		throw new Error('El tenant no tiene un diario APERTURA_CIERRE activo.');
	}

	// ── Sesion efimera y Server Actions reales ────────────────────────────────
	await ampliarTimeoutTransacciones();
	const sesion = await crearSesionEphemera(tenantId);
	process.env.OPS_AUTH_TOKEN = sesion.token;
	try {
		const acciones = await import('@/features/contabilidad/actions-periodos');
		const idempotencyKey = `ops-apertura-${tenantId.slice(-6)}-${fechaInicio
			.toISOString()
			.slice(0, 10)
			.replaceAll('-', '')}`;

		const solicitud = await acciones.solicitarAperturaManualAction({
			tipo: 'MENSUAL',
			categoria: 'ORDINARIO',
			modoContable: 'CAJA',
			fechaInicio: fechaInicio.toISOString(),
			fechaFin: fechaFin.toISOString(),
			observaciones:
				'Apertura manual con cuadre aprobado derivado de saldos operativos (operacion ops).',
			idempotencyKey,
			lineas: lineas.map((linea) => ({
				cuentaCodigo: linea.cuentaCodigo,
				moneda: linea.moneda,
				debito: linea.debito,
				credito: linea.credito,
			})),
		});
		if (!solicitud.success) {
			throw new Error(`solicitarAperturaManualAction: ${solicitud.error.message}`);
		}
		const solicitudId = solicitud.data.solicitudId;
		console.log(
			`\nsolicitud ${solicitudId} (estado ${solicitud.data.estado}${solicitud.data.replayed ? ', replay' : ''})`,
		);

		if (solicitud.data.estado === 'PENDIENTE') {
			const aprobacion = await acciones.aprobarAperturaManualAction({ solicitudId });
			if (!aprobacion.success) {
				throw new Error(`aprobarAperturaManualAction: ${aprobacion.error.message}`);
			}
			console.log(`aprobacion registrada: ${aprobacion.data.hashAprobacion}`);
		} else if (solicitud.data.estado === 'CONSUMIDA') {
			console.log('la solicitud ya fue consumida: el periodo ya estaba abierto');
			await verificarEstado(tenantId, fechaInicio);
			return;
		}

		const apertura = await acciones.abrirPeriodoManualAprobadoAction({ solicitudId });
		if (!apertura.success) {
			throw new Error(`abrirPeriodoManualAprobadoAction: ${apertura.error.message}`);
		}
		const periodo = apertura.data.periodo;
		console.log(`periodo abierto: ${periodo.periodoId} ${periodo.codigo} ${periodo.estado}`);

		// ── Verificacion ───────────────────────────────────────────────────────
		await verificarEstado(tenantId, fechaInicio);
	} finally {
		await prisma.userSession.delete({ where: { id: sesion.sessionId } });
		console.log('\nsesion efimera eliminada');
	}
}

main()
	.then(async () => {
		await prisma.$disconnect();
		process.exit(0);
	})
	.catch(async (error: unknown) => {
		console.error('\nERROR:', error instanceof Error ? error.message : error);
		await prisma.$disconnect();
		process.exit(1);
	});
