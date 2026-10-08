/**
 * @description Conciliación cruzada caja ↔ asientos (CTA-2): por cada rubro
 * clave compara el saldo contable (libros) contra el saldo operativo de la
 * base caja, exponiendo la diferencia exacta cuando divergen.
 * v1: los importes en moneda no funcional se excluyen del lado operativo y se
 * reportan como alcance limitado (la conversión real exige la evidencia FX).
 * @module src/features/contabilidad-formal/services/conciliacion-cruzada-service
 */

import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import { prisma } from '@/lib/prisma';

export type ClaveRubro = 'TESORERIA' | 'CXC' | 'CXP';

export interface RubroConciliacion {
	clave: ClaveRubro;
	nombre: string;
	saldoLibros: string | null;
	saldoOperativo: string | null;
	diferencia: string | null;
	estado: 'OK' | 'DIFERENCIA' | 'NO_EVALUABLE';
	nota?: string;
}

export interface ResultadoConciliacion {
	rubros: RubroConciliacion[];
	monedaFuncional: string;
	generadoAt: string;
	estado: 'CONFORME' | 'DIFERENCIA' | 'NO_EVALUABLE';
	enforceReady: boolean;
}

const ROLES_POR_RUBRO: Record<ClaveRubro, string[]> = {
	TESORERIA: ['CAJA_PRINCIPAL', 'BANCOS'],
	CXC: ['CXC_CLIENTES'],
	CXP: ['CXP_PROVEEDORES'],
};

const NOMBRES_RUBRO: Record<ClaveRubro, string> = {
	TESORERIA: 'Tesorería (caja y bancos)',
	CXC: 'Cuentas por cobrar',
	CXP: 'Cuentas por pagar',
};

const CERO = new Prisma.Decimal(0);

/**
 * @description Convierte un valor decimal de Prisma o de una fuente mockeada
 * sin pasar por IEEE-754.
 * @param {unknown} valor - Valor decimal de la persistencia.
 * @returns {Prisma.Decimal} Decimal exacto, o cero para un agregado ausente.
 */
function decimal(valor: unknown): Prisma.Decimal {
	if (valor === null || valor === undefined) return new Prisma.Decimal(CERO);
	if (valor instanceof Prisma.Decimal) return valor;
	if (typeof valor === 'string' || typeof valor === 'number') return new Prisma.Decimal(valor);
	return new Prisma.Decimal(CERO);
}

/**
 * @description Convierte un saldo persistido solo cuando existe evidencia decimal.
 * @param {unknown} valor - Valor decimal opcional de Prisma.
 * @returns {Prisma.Decimal | null} Decimal exacto o null si no hay dato.
 */
function decimalPersistido(valor: unknown): Prisma.Decimal | null {
	if (valor === null || valor === undefined) return null;
	if (valor instanceof Prisma.Decimal) return valor;
	if (typeof valor === 'string' || typeof valor === 'number') {
		try {
			return new Prisma.Decimal(valor);
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * @description Serializa un Decimal en forma plana y canónica para la frontera
 * de la acción y la UI, sin redondearlo a la escala de JavaScript.
 * @param {Prisma.Decimal} valor - Valor decimal exacto.
 * @returns {string} Representación decimal plana.
 */
function serializarDecimal(valor: Prisma.Decimal): string {
	return valor.toFixed();
}

/**
 * @description Suma el saldo contable por cuenta (en su naturaleza).
 */
async function saldoLibros(
	db: Prisma.TransactionClient,
	tenantId: string,
	cuentaIds: string[],
): Promise<Prisma.Decimal> {
	if (cuentaIds.length === 0) return new Prisma.Decimal(CERO);
	const agregados = await db.asientoLinea.groupBy({
		by: ['cuentaId'],
		where: { cuentaId: { in: cuentaIds }, asiento: { tenantId, estado: 'CONTABILIZADO' } },
		_sum: { debe: true, haber: true },
	});
	const cuentas = await db.cuentaContable.findMany({
		where: {
			tenantId,
			cuentaContableId: { in: cuentaIds },
			activa: true,
			aceptaMovimiento: true,
		},
		select: { cuentaContableId: true, naturaleza: true },
	});
	const naturalezaPorId = new Map(cuentas.map((c) => [c.cuentaContableId, c.naturaleza]));
	return agregados.reduce((total, a) => {
		const debe = decimal(a._sum.debe);
		const haber = decimal(a._sum.haber);
		const nat = naturalezaPorId.get(a.cuentaId);
		return total.add(nat === 'DEUDORA' ? debe.sub(haber) : haber.sub(debe));
	}, new Prisma.Decimal(CERO));
}

/**
 * @description Panel de conciliación cruzada entre la capa formal y la base caja.
 * @param {string} tenantId - Tenant propietario.
 * @param {{ fechaHasta?: Date }} _filtros - Reservado para corte temporal futuro.
 * @returns {Promise<ResultadoConciliacion>} Rubros comparados.
 */
async function leerConciliacionEnSnapshot(
	db: Prisma.TransactionClient,
	tenantId: string,
	filtros: { fechaHasta?: Date },
): Promise<ResultadoConciliacion> {
	const policy = await db.tenantAccountingPolicy.findUnique({
		where: { tenantId },
		select: { functionalCurrencyCode: true },
	});
	const currencyCode = policy?.functionalCurrencyCode?.trim().toUpperCase();
	const monedaFuncional = currencyCode && /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : 'XXX';
	if (monedaFuncional === 'XXX') {
		const rubros = (Object.keys(NOMBRES_RUBRO) as ClaveRubro[]).map((clave) => ({
			clave,
			nombre: NOMBRES_RUBRO[clave],
			saldoLibros: null,
			saldoOperativo: null,
			diferencia: null,
			estado: 'NO_EVALUABLE' as const,
			nota: 'No se configuró una moneda funcional válida para este tenant.',
		}));
		return {
			monedaFuncional,
			generadoAt: new Date().toISOString(),
			rubros,
			estado: 'NO_EVALUABLE',
			enforceReady: false,
		};
	}

	const roles = await db.cuentaRolTenant.findMany({
		where: { tenantId },
		select: { rol: true, cuentaId: true },
	});
	const cuentaIdsMapeadas = [...new Set(roles.map((rol) => rol.cuentaId))];
	const cuentasActivas = cuentaIdsMapeadas.length === 0
		? []
		: await db.cuentaContable.findMany({
				where: {
					tenantId,
					cuentaContableId: { in: cuentaIdsMapeadas },
					activa: true,
					aceptaMovimiento: true,
				},
				select: { cuentaContableId: true },
			});
	const cuentasValidas = new Set(cuentasActivas.map((cuenta) => cuenta.cuentaContableId));
	const cuentasPorRol = new Map<string, string>(
		roles
			.filter((rol) => cuentasValidas.has(rol.cuentaId))
			.map((rol) => [rol.rol, rol.cuentaId]),
	);

	const [tesoreriaLibros, cxcLibros, cxpLibros] = await Promise.all([
		saldoLibros(db,
			tenantId,
			ROLES_POR_RUBRO.TESORERIA.map((r) => cuentasPorRol.get(r)).filter((id): id is string => !!id),
		),
		saldoLibros(db,
			tenantId,
			ROLES_POR_RUBRO.CXC.map((r) => cuentasPorRol.get(r)).filter((id): id is string => !!id),
		),
		saldoLibros(db,
			tenantId,
			ROLES_POR_RUBRO.CXP.map((r) => cuentasPorRol.get(r)).filter((id): id is string => !!id),
		),
	]);

	const [cuentasBancarias, cxcOperativo, cxpOperativo] = await Promise.all([
		db.cuentaBancaria.findMany({
			where: { tenantId, isActive: true },
			select: { saldo: true, moneda: true },
		}),
		db.cuentaPorCobrar.findMany({
			where: { tenantId, estado: { not: 'ANULADA' } },
			select: {
				montoDeuda: true,
				montoPagado: true,
				montoOriginal: true,
				montoDeudaFuncional: true,
				montoPagadoFuncional: true,
				monedaOriginal: true,
				monedaFuncional: true,
				tasaCambio: true,
				fxEvidenceFingerprint: true,
				fxEvidenceVersion: true,
				rateEffectiveAt: true,
				fxProvenanceKind: true,
				fxProvenanceSource: true,
				fxCatalogRateId: true,
				fxEvidenceJson: true,
				facturaId: true,
				ventaServicioId: true,
			},
		}),
		db.cuentaPorPagar.findMany({
			where: { tenantId, deletedAt: null },
			select: { cuentaPorPagarId: true, saldoPendiente: true, moneda: true, montoDeuda: true, montoPagado: true },
		}),
	]);
	const facturaIds = cxcOperativo.flatMap((cuenta) => cuenta.facturaId ? [cuenta.facturaId] : []);
	const facturas = facturaIds.length === 0
		? []
		: await db.factura.findMany({
				where: { tenantId, idFactura: { in: facturaIds } },
				select: { idFactura: true, ventaId: true },
			});
	const idsFacturaEsperados = new Set(facturaIds);
	const facturaNoResuelta = facturas.length !== idsFacturaEsperados.size ||
		facturas.some((factura) => !idsFacturaEsperados.has(factura.idFactura));
	const ventaIds = facturas.flatMap((factura) => factura.ventaId ? [factura.ventaId] : []);
	const ventasConReconciliaciones = ventaIds.length === 0
		? []
		: await db.reconciliacionVenta.findMany({
				where: { tenantId, ventaId: { in: ventaIds } },
				select: { ventaId: true },
			});
	const serviciosIds = cxcOperativo.flatMap(
		(cuenta) => cuenta.ventaServicioId ? [cuenta.ventaServicioId] : [],
	);
	const servicios = serviciosIds.length === 0
		? []
		: await db.ventaServicios.findMany({
				where: { tenantId, ventaServicioId: { in: serviciosIds } },
				select: { ventaServicioId: true },
			});
	const idsServiciosEsperados = new Set(serviciosIds);
	const servicioNoResuelto = servicios.length !== idsServiciosEsperados.size ||
		servicios.some((servicio) => !idsServiciosEsperados.has(servicio.ventaServicioId));
	const serviciosConReconciliaciones = serviciosIds.length === 0
		? []
		: await db.reconciliacionServicio.findMany({
				where: { tenantId, ventaServicioId: { in: serviciosIds } },
				select: { ventaServicioId: true },
			});
	const ventasConPago = new Set(ventasConReconciliaciones.map((rec) => rec.ventaId));
	const facturasConPago = new Set(
		facturas.filter((factura) => factura.ventaId && ventasConPago.has(factura.ventaId))
			.map((factura) => factura.idFactura),
	);
	const serviciosConPago = new Set(serviciosConReconciliaciones.map((rec) => rec.ventaServicioId));
	const pagosCxp = cxpOperativo.length === 0 ? [] : await db.pagoCuentaPorPagar.findMany({
		where: {
			cuentaPorPagarId: { in: cxpOperativo.map((cuenta) => cuenta.cuentaPorPagarId) },
			cuentaPorPagar: { tenantId, deletedAt: null },
		},
		select: { cuentaPorPagarId: true },
	});
	const cuentasCxpConPago = new Set(pagosCxp.map((pago) => pago.cuentaPorPagarId));

	const esMonedaFuncional = (moneda: unknown) =>
		typeof moneda === 'string' && moneda.trim().toUpperCase() === monedaFuncional;
	const cuentasBancariasFuncionales = cuentasBancarias.filter((cuenta) =>
		esMonedaFuncional(cuenta.moneda),
	);
	const cuentaBancariaNoComparable = cuentasBancarias.some(
		(cuenta) => !esMonedaFuncional(cuenta.moneda)
			&& !decimal(cuenta.saldo).isZero(),
	);
	const tesoreriaOperativo = cuentasBancariasFuncionales.reduce(
		(s, c) => s.add(decimal(c.saldo)),
		new Prisma.Decimal(CERO),
	);
	let cxcComparable = cxcOperativo.length > 0;
	if (facturaNoResuelta || servicioNoResuelto) cxcComparable = false;
	const cxcOperativoTotal = cxcOperativo.reduce((total, cuenta) => {
		const deuda = decimalPersistido(cuenta.montoDeuda);
		const pagado = decimalPersistido(cuenta.montoPagado);
		if (!deuda || !pagado || deuda.lt(0) || pagado.lt(0) || pagado.gt(deuda)) {
			cxcComparable = false;
			return total;
		}
		if ((cuenta.facturaId && facturasConPago.has(cuenta.facturaId)) ||
			(cuenta.ventaServicioId && serviciosConPago.has(cuenta.ventaServicioId))) {
			cxcComparable = false;
			return total;
		}

		const original = decimalPersistido(cuenta.montoOriginal);
		const deudaFuncional = decimalPersistido(cuenta.montoDeudaFuncional);
		const pagadoFuncional = decimalPersistido(cuenta.montoPagadoFuncional);
		const monedaOriginal = typeof cuenta.monedaOriginal === 'string'
			? cuenta.monedaOriginal.trim().toUpperCase()
			: '';
		const monedaRegistroFuncional = typeof cuenta.monedaFuncional === 'string'
			? cuenta.monedaFuncional.trim().toUpperCase()
			: '';
		const tasa = decimalPersistido(cuenta.tasaCambio);
		const esExtranjera = monedaOriginal !== monedaFuncional;
		const montoFuncionalEsperado = original?.mul(esExtranjera ? (tasa ?? 0) : 1)
			.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
		let tieneEvidenciaFx = false;
		if (esExtranjera && original && deudaFuncional && tasa &&
			cuenta.rateEffectiveAt instanceof Date && cuenta.fxProvenanceSource &&
			(cuenta.fxProvenanceKind === 'MANUAL_GOVERNED' || cuenta.fxProvenanceKind === 'CATALOG_RATE')) {
			try {
				const canonical = buildAppliedFxEvidenceExact({
					originalAmount: original,
					originalCurrency: monedaOriginal,
					functionalCurrency: monedaFuncional,
					exchangeRate: tasa,
					convertedAmount: deudaFuncional,
					rateEffectiveAt: cuenta.rateEffectiveAt,
					source: cuenta.fxProvenanceSource,
					fxCatalogRateId: cuenta.fxCatalogRateId,
					fxProvenanceKind: cuenta.fxProvenanceKind,
				});
				const stored = cuenta.fxEvidenceJson as Record<string, unknown> | null;
				tieneEvidenciaFx = Boolean(stored &&
					stored.fxEvidenceFingerprint === canonical.evidence.fxEvidenceFingerprint &&
					stored.rateEffectiveAt === canonical.evidence.rateEffectiveAt &&
					stored.fxProvenanceKind === canonical.evidence.fxProvenanceKind &&
					stored.fxProvenanceSource === canonical.evidence.fxProvenanceSource &&
					stored.fxEvidenceVersion === canonical.evidence.fxEvidenceVersion &&
					stored.functionalCurrency === canonical.evidence.functionalCurrency &&
					stored.fxCatalogRateId === canonical.evidence.fxCatalogRateId &&
					stored.originalAmount === canonical.evidence.originalAmount &&
					stored.functionalAmount === canonical.evidence.functionalAmount &&
					stored.originalCurrency === canonical.evidence.originalCurrency &&
					cuenta.fxEvidenceFingerprint === canonical.evidence.fxEvidenceFingerprint &&
					cuenta.fxEvidenceVersion === canonical.evidence.fxEvidenceVersion);
			} catch {
				tieneEvidenciaFx = false;
			}
		}
		const pagoFuncionalValido = pagado.isZero()
			? pagadoFuncional === null || pagadoFuncional.isZero()
			: esExtranjera
				? pagadoFuncional !== null && !pagadoFuncional.lt(0)
				: pagadoFuncional === null || pagadoFuncional.eq(pagado);
		if (
			!monedaOriginal || monedaRegistroFuncional !== monedaFuncional ||
			!original || !original.gt(0) || !original.eq(deuda) ||
			!deudaFuncional || !deudaFuncional.gt(0) ||
			(esExtranjera && !tieneEvidenciaFx) ||
			!montoFuncionalEsperado?.eq(deudaFuncional) || !pagoFuncionalValido
		) {
			cxcComparable = false;
			return total;
		}
		if (deuda.sub(pagado).isZero()) return total;

		// Allocate the original carrying value by nominal principal paid. Do not
		// subtract actual functional cash received: it contains realized FX.
		const valorLiquidadoEnLibros = pagado.gte(original)
			? deudaFuncional
			: deudaFuncional.mul(pagado).div(original)
				.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
		return total.add(deudaFuncional.sub(valorLiquidadoEnLibros));
	}, new Prisma.Decimal(CERO));
	let cxpComparable = cxpOperativo.length > 0;
	const cxpOperativoTotal = cxpOperativo.reduce((total, cuenta) => {
		const pendiente = decimalPersistido(cuenta.saldoPendiente);
		const deuda = decimalPersistido(cuenta.montoDeuda);
		const pagado = decimalPersistido(cuenta.montoPagado);
		if (!pendiente || !deuda || !pagado || deuda.lt(0) || pagado.lt(0) ||
			pagado.gt(deuda) || !pendiente.eq(deuda.sub(pagado))) {
			cxpComparable = false;
			return total;
		}
		if (!pagado.isZero() || cuentasCxpConPago.has(cuenta.cuentaPorPagarId)) {
			cxpComparable = false;
			return total;
		}
		if (pendiente.isZero()) return total;
		if (!esMonedaFuncional(cuenta.moneda)) {
			cxpComparable = false;
			return total;
		}
		return total.add(pendiente);
	}, new Prisma.Decimal(CERO));

	function rubro(
		clave: ClaveRubro,
		libros: Prisma.Decimal,
		operativo: Prisma.Decimal | null,
		fuenteComparable: boolean,
		nota?: string,
	): RubroConciliacion {
		const diferencia = operativo === null ? null : libros.sub(operativo);
		const coberturaParcial = filtros.fechaHasta !== undefined;
		const estado = coberturaParcial || !fuenteComparable
			? 'NO_EVALUABLE'
			: diferencia !== null && diferencia.isZero() ? 'OK' : 'DIFERENCIA';
		return {
			clave,
			nombre: NOMBRES_RUBRO[clave],
			saldoLibros: coberturaParcial ? null : serializarDecimal(libros),
			saldoOperativo: coberturaParcial || operativo === null ? null : serializarDecimal(operativo),
			diferencia: coberturaParcial || diferencia === null ? null : serializarDecimal(diferencia),
			estado: estado,
			nota: coberturaParcial
				? 'Período parcial: la cobertura no permite evaluar este rubro.'
				: !fuenteComparable
					? nota ?? 'El rubro no tiene una fuente comparable en ambos lados.'
					: nota,
		};
	}

	const rolesCompletosPorRubro = (clave: ClaveRubro) =>
		ROLES_POR_RUBRO[clave].every((rol) => Boolean(cuentasPorRol.get(rol)));
	// CuentaPorCobrar has no currency/functional fields to prove comparability.
	const cxcFuenteComparable = cxcComparable;
	const cxcNota = 'Las cuentas por cobrar no tienen valoración funcional completa y verificable.';
	const cxpPendientes = cxpOperativo.filter((cuenta) => !decimal(cuenta.saldoPendiente).isZero());
	const cxpMonedaComparable = cxpComparable && cxpOperativo.length > 0 && cxpPendientes.every(
		(cuenta) => esMonedaFuncional(cuenta.moneda),
	);
	const cxpNota = cxpMonedaComparable || cxpOperativo.length === 0
		? undefined
		: 'Las cuentas por pagar incluyen moneda no comparable o pagos sin moneda verificable.';
	const rubros = [
		rubro(
			'TESORERIA',
			tesoreriaLibros,
			tesoreriaOperativo,
			rolesCompletosPorRubro('TESORERIA')
				&& cuentasBancariasFuncionales.length > 0
				&& !cuentaBancariaNoComparable,
			cuentaBancariaNoComparable
				? 'Las cuentas bancarias activas incluyen moneda distinta de la funcional sin valoración funcional persistida.'
				: undefined,
		),
		rubro('CXC', cxcLibros, cxcFuenteComparable ? cxcOperativoTotal : null,
			rolesCompletosPorRubro('CXC') && cxcFuenteComparable, cxcNota),
		rubro('CXP', cxpLibros, cxpMonedaComparable ? cxpOperativoTotal : null,
			rolesCompletosPorRubro('CXP') && cxpMonedaComparable, cxpNota),
	];
	const estado = rubros.some((r) => r.estado === 'NO_EVALUABLE')
		? 'NO_EVALUABLE'
		: rubros.some((r) => r.estado === 'DIFERENCIA') ? 'DIFERENCIA' : 'CONFORME';

	return {
		monedaFuncional,
		generadoAt: new Date().toISOString(),
		rubros,
		estado,
		enforceReady: estado === 'CONFORME',
	};
}

/**
 * @description Obtiene libros y saldos operativos desde el mismo snapshot.
 * @param {string} tenantId - Tenant propietario.
 * @param {{ fechaHasta?: Date }} filtros - Corte solicitado.
 * @returns {Promise<ResultadoConciliacion>} Resultado exacto de conciliación.
 */
export async function obtenerConciliacionCruzada(
	tenantId: string,
	filtros: { fechaHasta?: Date },
): Promise<ResultadoConciliacion> {
	return prisma.$transaction(
		(tx) => leerConciliacionEnSnapshot(tx, tenantId, filtros),
		{ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
	);
}
