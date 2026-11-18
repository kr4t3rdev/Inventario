import { Prisma } from '@/generated/prisma';

import { buildFunctionalValuation } from '@/features/contabilidad-formal/lib/functional-valuation';
import { emitirEventoLiquidacion } from '@/features/contabilidad-formal/services/settlement-posting-service';
import { PrismaExchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';

import { calculateInitialSubledgerSettlement } from './initial-subledger-settlement';

/**
 * @description Escritor de liquidaciones de submayor inicial externa (tarea 4,
 * tramo 2). Cobra o paga una CxC/CxP cargada en la inicialización, en una sola
 * transacción: bloquea la cuenta, resuelve la tasa del catálogo a la fecha
 * efectiva, valora el pago, crea el registro operativo, mueve el banco,
 * emite el asiento formal con su diferencia FX y actualiza el saldo.
 *
 * Reglas (decisiones del usuario 2026-11-18):
 * - El cobro/pago es siempre en la moneda de la obligación; la diferencia
 *   entre el funcional pagado y el valor contable aplicado va a diferencia FX.
 * - La tasa es la del catálogo vigente a la fecha efectiva; sin tasa no hay
 *   liquidación en divisa (falla cerrado).
 * - La cuenta bancaria debe estar en la misma moneda que el cobro/pago.
 * - Solo ruta de servidor: no hay cambios de UI en este tramo.
 */
export class InitialSubledgerSettlementError extends Error {
	constructor(
		public readonly code: string,
		message: string,
	) {
		// El código va en el mensaje, como en la calculadora pura: los tests y
		// las actions lo localizan con toThrow('CODIGO').
		super(`${code}: ${message}`);
		this.name = 'InitialSubledgerSettlementError';
	}
}

export interface SettleInitialReceivableParams {
	tenantId: string;
	cuentaPorCobrarId: string;
	cuentaId: string;
	tipoPagoId: string;
	monto: string;
	fechaEfectiva: Date;
	referencia: string;
	observaciones?: string;
	actorId: string;
}

export interface SettleInitialPayableParams {
	tenantId: string;
	cuentaPorPagarId: string;
	cuentaId: string;
	monto: string;
	fechaEfectiva: Date;
	referencia: string;
	cuentaProveedor?: string;
	observaciones?: string;
	actorId: string;
}

export interface InitialSubledgerSettlementResult {
	reconciliacionId?: string;
	pagoCuentaPorPagarId?: string;
	aplicadoOriginal: string;
	aplicadoFuncional: string;
	pagadoFuncional: string;
	diferenciaFuncional: string;
	remanenteOriginal: string;
	remanenteFuncional: string;
	estado: 'PARCIAL' | 'PAGADA';
	posteoFormal: { estado: string; motivo?: string; asientoId?: string };
}

type SettlementTx = Prisma.TransactionClient;

const SOURCE = 'initial-subledger-settlement';
const AMOUNT_PATTERN = /^\d+(?:\.\d{1,4})?$/;

function fail(code: string, message: string): never {
	throw new InitialSubledgerSettlementError(code, message);
}

function parseSettlementAmount(value: string): Prisma.Decimal {
	if (typeof value !== 'string' || !AMOUNT_PATTERN.test(value)) {
		fail('INITIAL_SETTLEMENT_AMOUNT_INVALID', 'El monto debe ser un decimal positivo de hasta 4 decimales');
	}
	const amount = new Prisma.Decimal(value);
	if (!amount.isFinite() || amount.lte(0)) {
		fail('INITIAL_SETTLEMENT_AMOUNT_INVALID', 'El monto debe ser mayor que cero');
	}
	return amount;
}

function to4dp(value: Prisma.Decimal | number | string): string {
	return new Prisma.Decimal(value.toString()).toFixed(4);
}

function decimalOf(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
	if (value == null) return new Prisma.Decimal(0);
	return new Prisma.Decimal(value.toString());
}

interface CatalogRate {
	tasa: number;
	tasaId: string | null;
	fechaVigencia: Date | null;
}

async function resolveSettlementRate(
	tx: SettlementTx,
	moneda: string,
	functionalCurrency: string,
	fechaEfectiva: Date,
): Promise<CatalogRate> {
	if (moneda === functionalCurrency) {
		return { tasa: 1, tasaId: null, fechaVigencia: null };
	}
	const provider = new PrismaExchangeRateProvider();
	const rate = await provider.getRateAsOf({
		sourceCurrency: moneda,
		targetCurrency: functionalCurrency,
		boundaryAt: fechaEfectiva,
		client: tx,
	});
	if (!rate) {
		fail(
			'INITIAL_SETTLEMENT_FX_REQUIRED',
			`Sin tasa de cambio de ${moneda} a ${functionalCurrency} vigente a la fecha efectiva`,
		);
	}
	return { tasa: rate.tasa, tasaId: rate.tasaId, fechaVigencia: rate.fechaVigencia };
}

async function resolveFunctionalCurrency(tx: SettlementTx, tenantId: string): Promise<string> {
	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId },
		select: { functionalCurrencyCode: true },
	});
	const functional = policy?.functionalCurrencyCode?.trim().toUpperCase() || null;
	if (!functional) {
		fail('INITIAL_SETTLEMENT_SIN_MONEDA_FUNCIONAL', 'El tenant no tiene moneda funcional definida');
	}
	return functional;
}

async function resolveBankAccount(
	tx: SettlementTx,
	tenantId: string,
	cuentaId: string,
	moneda: string,
): Promise<{ tipoCuenta: string | null; saldo: number }> {
	await tx.$queryRaw`
		SELECT 1 FROM "CuentaBancaria"
		WHERE "cuentaId" = ${cuentaId} AND "tenantId" = ${tenantId}
		FOR UPDATE
	`;
	const cuenta = await tx.cuentaBancaria.findFirst({
		where: { cuentaId, tenantId },
		select: { cuentaId: true, moneda: true, saldo: true, isActive: true, tipoCuenta: true },
	});
	if (!cuenta || !cuenta.isActive) {
		fail('INITIAL_SETTLEMENT_CUENTA_INVALIDA', 'Cuenta bancaria no encontrada o inactiva');
	}
	if (cuenta.moneda.trim().toUpperCase() !== moneda) {
		fail(
			'INITIAL_SETTLEMENT_CUENTA_MONEDA_INVALIDA',
			`La cuenta bancaria está en ${cuenta.moneda} y el cobro/pago es en ${moneda}`,
		);
	}
	return { tipoCuenta: cuenta.tipoCuenta, saldo: Number(cuenta.saldo) };
}

interface SettlementValuation {
	paymentFunctional: string;
	rate: CatalogRate;
	fxEvidence: NonNullable<ReturnType<typeof buildFunctionalValuation>['fxEvidence']>;
}

async function buildSettlementValuation(
	tx: SettlementTx,
	moneda: string,
	functionalCurrency: string,
	monto: Prisma.Decimal,
	fechaEfectiva: Date,
): Promise<SettlementValuation> {
	const rate = await resolveSettlementRate(tx, moneda, functionalCurrency, fechaEfectiva);
	const valuation = buildFunctionalValuation({
		monto: monto.toNumber(),
		moneda,
		functionalCurrency,
		tasaCambio: rate.tasa,
		fechaOperacion: fechaEfectiva,
		fechaTasa: rate.fechaVigencia ?? undefined,
		fxCatalogRateId: rate.tasaId ?? undefined,
		source: SOURCE,
	});
	// En misma moneda la valoración devuelve montoConvertido null: el funcional
	// es el propio monto.
	const paymentFunctional = valuation.montoConvertido == null ? to4dp(monto) : to4dp(valuation.montoConvertido);
	if (!valuation.fxEvidence) {
		fail('INITIAL_SETTLEMENT_FX_REQUIRED', 'No se pudo valorar el cobro/pago en moneda funcional');
	}
	return { paymentFunctional, rate, fxEvidence: valuation.fxEvidence };
}

function fxEvidenceColumns(evidence: SettlementValuation['fxEvidence'], rate: CatalogRate) {
	return {
		fxProvenanceKind: evidence.fxProvenanceKind,
		fxProvenanceSource: evidence.fxProvenanceSource,
		fxCatalogRateId: evidence.fxCatalogRateId,
		fxEvidenceJson: { ...evidence },
		fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
		fxEvidenceVersion: evidence.fxEvidenceVersion,
		rateEffectiveAt: rate.fechaVigencia ? new Date(rate.fechaVigencia.getTime()) : null,
	};
}

/**
 * @description Cobra una CxC inicial externa (parcial o total) en una transacción.
 * @param {SettlementTx} tx - Transacción Prisma activa.
 * @param {SettleInitialReceivableParams} params - Cuenta, banco, monto y referencia.
 * @returns {Promise<InitialSubledgerSettlementResult>} Aplicado, remanente y posteo.
 */
export async function settleInitialReceivable(
	tx: SettlementTx,
	params: SettleInitialReceivableParams,
): Promise<InitialSubledgerSettlementResult> {
	const monto = parseSettlementAmount(params.monto);
	if (Number.isNaN(params.fechaEfectiva.getTime())) {
		fail('INITIAL_SETTLEMENT_FECHA_INVALIDA', 'La fecha efectiva no es válida');
	}
	const cuenta = await (async () => {
		await tx.$queryRaw`
			SELECT 1 FROM "CuentaPorCobrar"
			WHERE "id" = ${params.cuentaPorCobrarId} AND "tenantId" = ${params.tenantId}
			FOR UPDATE
		`;
		const row = await tx.cuentaPorCobrar.findFirst({
			where: { id: params.cuentaPorCobrarId, tenantId: params.tenantId },
			select: {
				id: true,
				inicializacionId: true,
				monedaOriginal: true,
				montoDeuda: true,
				montoPagado: true,
				montoDeudaFuncional: true,
				montoPagadoFuncional: true,
				estado: true,
			},
		});
		if (!row) {
			fail('INITIAL_SETTLEMENT_CUENTA_NO_ENCONTRADA', 'Cuenta por cobrar no encontrada');
		}
		if (!row.inicializacionId) {
			fail('INITIAL_SETTLEMENT_CUENTA_NO_INICIAL', 'La cuenta por cobrar no es inicial externa');
		}
		if (row.estado === 'PAGADA' || row.estado === 'ANULADA') {
			fail('INITIAL_SETTLEMENT_CUENTA_PAGADA', 'La cuenta por cobrar ya está liquidada');
		}
		return row;
	})();
	const obligationCurrency = (cuenta.monedaOriginal ?? '').trim().toUpperCase();
	if (!obligationCurrency) {
		fail('INITIAL_SETTLEMENT_CUENTA_NO_ENCONTRADA', 'La cuenta por cobrar no tiene moneda original');
	}

	const functionalCurrency = await resolveFunctionalCurrency(tx, params.tenantId);
	const bank = await resolveBankAccount(tx, params.tenantId, params.cuentaId, obligationCurrency);

	const tipoPago = await tx.tipoPago.findFirst({
		where: { tipoId: params.tipoPagoId, tenantId: params.tenantId },
		select: { tipoId: true, isActive: true },
	});
	if (!tipoPago || !tipoPago.isActive) {
		fail('INITIAL_SETTLEMENT_TIPO_PAGO_INVALIDO', 'Tipo de pago no encontrado o inactivo');
	}

	const duplicado = await tx.reconciliacionVenta.findFirst({
		where: { tenantId: params.tenantId, idempotencyKey: params.referencia },
		select: { reconciliacionId: true },
	});
	if (duplicado) {
		fail('INITIAL_SETTLEMENT_DUPLICATE', 'Ya existe un cobro con esa referencia');
	}

	const saldoPendiente = decimalOf(cuenta.montoDeuda).minus(decimalOf(cuenta.montoPagado));
	const remanenteFuncionalPrevio = decimalOf(cuenta.montoDeudaFuncional).minus(
		decimalOf(cuenta.montoPagadoFuncional),
	);
	const valuation = await buildSettlementValuation(
		tx,
		obligationCurrency,
		functionalCurrency,
		monto,
		params.fechaEfectiva,
	);
	const settlement = calculateInitialSubledgerSettlement({
		role: 'receivable',
		balanceOriginal: to4dp(saldoPendiente),
		balanceFunctional: to4dp(remanenteFuncionalPrevio),
		obligationCurrency: obligationCurrency,
		paymentCurrency: obligationCurrency,
		functionalCurrency,
		paymentOriginal: to4dp(monto),
		paymentFunctional: valuation.paymentFunctional,
	});
	const diferenciaFuncional = new Prisma.Decimal(settlement.paymentFunctional)
		.minus(settlement.appliedBookFunctional)
		.toFixed(4);

	const saldoActualizado = await tx.cuentaBancaria.updateMany({
		where: { cuentaId: params.cuentaId, tenantId: params.tenantId },
		data: { saldo: { increment: monto.toNumber() } },
	});
	if (saldoActualizado.count !== 1) {
		fail('INITIAL_SETTLEMENT_CUENTA_INVALIDA', 'Cuenta bancaria no encontrada');
	}

	let reconciliacion: { reconciliacionId: string; fechaReconciliacion: Date };
	try {
		reconciliacion = await tx.reconciliacionVenta.create({
			data: {
				tenantId: params.tenantId,
				ventaId: null,
				cuentaPorCobrarId: params.cuentaPorCobrarId,
				cuentaId: params.cuentaId,
				tipoPagoId: params.tipoPagoId,
				monto,
				moneda: obligationCurrency,
				montoConvertido: new Prisma.Decimal(valuation.paymentFunctional),
				tasaCambio: new Prisma.Decimal(valuation.rate.tasa),
				functionalCurrency,
				...fxEvidenceColumns(valuation.fxEvidence, valuation.rate),
				fechaReconciliacion: params.fechaEfectiva,
				idempotencyKey: params.referencia,
				observaciones: params.observaciones,
				reconciliadoPor: params.actorId,
			},
			select: { reconciliacionId: true, fechaReconciliacion: true },
		});
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			fail('INITIAL_SETTLEMENT_DUPLICATE', 'Ya existe un cobro con esa referencia');
		}
		throw error;
	}

	const posteoFormal = await emitirEventoLiquidacion(
		tx,
		{ tenantId: params.tenantId, userId: params.actorId },
		{
			tipo: 'COBRO_CXC',
			reconciliacion: {
				reconciliacionId: reconciliacion.reconciliacionId,
				monto,
				moneda: obligationCurrency,
				montoConvertido: new Prisma.Decimal(valuation.paymentFunctional),
				functionalCurrency,
				tasaCambio: new Prisma.Decimal(valuation.rate.tasa),
				fxEvidenceFingerprint: valuation.fxEvidence.fxEvidenceFingerprint,
				fechaReconciliacion: reconciliacion.fechaReconciliacion,
			},
			functionalAmount: valuation.paymentFunctional,
			exchangeRate: new Prisma.Decimal(valuation.rate.tasa),
			fxEvidenceFingerprint: valuation.fxEvidence.fxEvidenceFingerprint,
			valorContableAplicado: settlement.appliedBookFunctional,
			origenExterno: 'cobro_cxc_externo',
			treasuryAccountType: bank.tipoCuenta,
			descripcion: params.observaciones ?? 'Cobro de cuenta por cobrar inicial',
		},
	);

	const estado = settlement.remainingOriginal === '0.0000' ? 'PAGADA' : 'PARCIAL';
	const actualizado = await tx.cuentaPorCobrar.updateMany({
		where: { id: params.cuentaPorCobrarId, tenantId: params.tenantId },
		data: {
			montoPagado: decimalOf(cuenta.montoPagado).plus(monto),
			montoPagadoFuncional: decimalOf(cuenta.montoPagadoFuncional).plus(
				settlement.appliedBookFunctional,
			),
			estado,
		},
	});
	if (actualizado.count !== 1) {
		fail('INITIAL_SETTLEMENT_CUENTA_NO_ENCONTRADA', 'Cuenta por cobrar no encontrada');
	}

	return {
		reconciliacionId: reconciliacion.reconciliacionId,
		aplicadoOriginal: settlement.appliedOriginal,
		aplicadoFuncional: settlement.appliedBookFunctional,
		pagadoFuncional: settlement.paymentFunctional,
		diferenciaFuncional,
		remanenteOriginal: settlement.remainingOriginal,
		remanenteFuncional: settlement.remainingBookFunctional,
		estado,
		posteoFormal,
	};
}

/**
 * @description Paga una CxP inicial externa (parcial o total) en una transacción.
 * @param {SettlementTx} tx - Transacción Prisma activa.
 * @param {SettleInitialPayableParams} params - Cuenta, banco, monto y referencia.
 * @returns {Promise<InitialSubledgerSettlementResult>} Aplicado, remanente y posteo.
 */
export async function settleInitialPayable(
	tx: SettlementTx,
	params: SettleInitialPayableParams,
): Promise<InitialSubledgerSettlementResult> {
	const monto = parseSettlementAmount(params.monto);
	if (Number.isNaN(params.fechaEfectiva.getTime())) {
		fail('INITIAL_SETTLEMENT_FECHA_INVALIDA', 'La fecha efectiva no es válida');
	}

	await tx.$queryRaw`
		SELECT 1 FROM "CuentaPorPagar"
		WHERE "cuentaPorPagarId" = ${params.cuentaPorPagarId} AND "tenantId" = ${params.tenantId}
		FOR UPDATE
	`;
	const cuenta = await tx.cuentaPorPagar.findFirst({
		where: { cuentaPorPagarId: params.cuentaPorPagarId, tenantId: params.tenantId },
		select: {
			cuentaPorPagarId: true,
			inicializacionId: true,
			monedaOriginal: true,
			montoDeuda: true,
			montoPagado: true,
			montoDeudaFuncional: true,
			montoPagadoFuncional: true,
			saldoPendiente: true,
			estado: true,
			proveedor: { select: { cuentaCUP: true, cuentaUSD: true } },
		},
	});
	if (!cuenta) {
		fail('INITIAL_SETTLEMENT_CUENTA_NO_ENCONTRADA', 'Cuenta por pagar no encontrada');
	}
	if (!cuenta.inicializacionId) {
		fail('INITIAL_SETTLEMENT_CUENTA_NO_INICIAL', 'La cuenta por pagar no es inicial externa');
	}
	const deuda = await tx.deudaCash.findFirst({
		where: { cuentaPorPagarId: params.cuentaPorPagarId, tenantId: params.tenantId, deletedAt: null },
		select: { id: true },
	});
	if (deuda) {
		fail('INITIAL_SETTLEMENT_DEUDA_CASH', 'Esta cuenta por pagar es una deuda cash; págala desde Deudas cash');
	}
	if (cuenta.estado === 'PAGADA') {
		fail('INITIAL_SETTLEMENT_CUENTA_PAGADA', 'La cuenta por pagar ya está liquidada');
	}
	const moneda = (cuenta.monedaOriginal ?? '').trim().toUpperCase();
	if (!moneda) {
		fail('INITIAL_SETTLEMENT_CUENTA_NO_ENCONTRADA', 'La cuenta por pagar no tiene moneda original');
	}

	const functionalCurrency = await resolveFunctionalCurrency(tx, params.tenantId);
	const bank = await resolveBankAccount(tx, params.tenantId, params.cuentaId, moneda);
	if (bank.saldo < monto.toNumber() - 0.000001) {
		fail('INITIAL_SETTLEMENT_SALDO_INSUFICIENTE', 'Saldo insuficiente en la cuenta bancaria');
	}

	const duplicado = await tx.pagoCuentaPorPagar.findFirst({
		where: { cuentaPorPagarId: params.cuentaPorPagarId, numeroTransaccion: params.referencia },
		select: { pagoCuentaPorPagarId: true },
	});
	if (duplicado) {
		fail('INITIAL_SETTLEMENT_DUPLICATE', 'Ya existe un pago con esa referencia para esta cuenta');
	}

	const saldoPendiente = decimalOf(cuenta.saldoPendiente);
	const remanenteFuncionalPrevio = decimalOf(cuenta.montoDeudaFuncional).minus(
		decimalOf(cuenta.montoPagadoFuncional),
	);
	const valuation = await buildSettlementValuation(tx, moneda, functionalCurrency, monto, params.fechaEfectiva);
	const settlement = calculateInitialSubledgerSettlement({
		role: 'payable',
		balanceOriginal: to4dp(saldoPendiente),
		balanceFunctional: to4dp(remanenteFuncionalPrevio),
		obligationCurrency: moneda,
		paymentCurrency: moneda,
		functionalCurrency,
		paymentOriginal: to4dp(monto),
		paymentFunctional: valuation.paymentFunctional,
	});
	const diferenciaFuncional = new Prisma.Decimal(settlement.appliedBookFunctional)
		.minus(settlement.paymentFunctional)
		.toFixed(4);

	const saldoActualizado = await tx.cuentaBancaria.updateMany({
		where: { cuentaId: params.cuentaId, tenantId: params.tenantId },
		data: { saldo: { decrement: monto.toNumber() } },
	});
	if (saldoActualizado.count !== 1) {
		fail('INITIAL_SETTLEMENT_CUENTA_INVALIDA', 'Cuenta bancaria no encontrada');
	}

	const cuentaProveedor =
		params.cuentaProveedor?.trim() ||
		(moneda === 'USD' ? cuenta.proveedor?.cuentaUSD : cuenta.proveedor?.cuentaCUP) ||
		'N/A';
	const pago = await tx.pagoCuentaPorPagar.create({
		data: {
			tenantId: params.tenantId,
			cuentaPorPagarId: params.cuentaPorPagarId,
			cuentaId: params.cuentaId,
			monto,
			moneda,
			montoFuncional: new Prisma.Decimal(valuation.paymentFunctional),
			tasaCambio: new Prisma.Decimal(valuation.rate.tasa),
			functionalCurrency,
			...fxEvidenceColumns(valuation.fxEvidence, valuation.rate),
			numeroTransaccion: params.referencia,
			cuentaProveedor,
			fechaPago: params.fechaEfectiva,
			observaciones: params.observaciones,
		},
		select: { pagoCuentaPorPagarId: true },
	});

	const posteoFormal = await emitirEventoLiquidacion(
		tx,
		{ tenantId: params.tenantId, userId: params.actorId },
		{
			tipo: 'PAGO_CXP',
			reconciliacion: {
				reconciliacionId: pago.pagoCuentaPorPagarId,
				monto,
				moneda,
				montoConvertido: new Prisma.Decimal(valuation.paymentFunctional),
				functionalCurrency,
				tasaCambio: new Prisma.Decimal(valuation.rate.tasa),
				fxEvidenceFingerprint: valuation.fxEvidence.fxEvidenceFingerprint,
				fechaReconciliacion: params.fechaEfectiva,
			},
			functionalAmount: valuation.paymentFunctional,
			exchangeRate: new Prisma.Decimal(valuation.rate.tasa),
			fxEvidenceFingerprint: valuation.fxEvidence.fxEvidenceFingerprint,
			valorContableAplicado: settlement.appliedBookFunctional,
			origenExterno: 'pago_cxp_externo',
			treasuryAccountType: bank.tipoCuenta,
			descripcion: params.observaciones ?? 'Pago de cuenta por pagar inicial',
		},
	);

	const estado = settlement.remainingOriginal === '0.0000' ? 'PAGADA' : 'PARCIAL';
	const actualizado = await tx.cuentaPorPagar.updateMany({
		where: { cuentaPorPagarId: params.cuentaPorPagarId, tenantId: params.tenantId },
		data: {
			montoPagado: decimalOf(cuenta.montoPagado).plus(monto),
			montoPagadoFuncional: decimalOf(cuenta.montoPagadoFuncional).plus(
				settlement.appliedBookFunctional,
			),
			saldoPendiente: new Prisma.Decimal(settlement.remainingOriginal),
			estado,
		},
	});
	if (actualizado.count !== 1) {
		fail('INITIAL_SETTLEMENT_CUENTA_NO_ENCONTRADA', 'Cuenta por pagar no encontrada');
	}

	return {
		pagoCuentaPorPagarId: pago.pagoCuentaPorPagarId,
		aplicadoOriginal: settlement.appliedOriginal,
		aplicadoFuncional: settlement.appliedBookFunctional,
		pagadoFuncional: settlement.paymentFunctional,
		diferenciaFuncional,
		remanenteOriginal: settlement.remainingOriginal,
		remanenteFuncional: settlement.remainingBookFunctional,
		estado,
		posteoFormal,
	};
}
