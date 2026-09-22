/**
 * @description Constructores puros de eventos contables para los writers de la
 * base caja (CTA-1). Cada builder recibe el payload real de la operación y
 * devuelve el `EventoContableInput` completo para `postEvento`. La semántica de
 * moneda: las líneas TOTAL conservan la valoración original; el resto opera en
 * moneda funcional (misma fuente que `buildPersistedAccountingAmount`).
 * @module src/features/contabilidad-formal/lib/event-builders
 */

import type { EventoContableInput } from '@/features/contabilidad-formal/services/posting-engine';

const MONEDA_FUNCIONAL_DEFECTO = 'CUP';

/** Parámetros de tesorería compartidos por cobros y ventas al contado. */
export interface ParamsTesoreria {
	/** Monto en moneda original del cobro. */
	monto: number;
	moneda: string;
	/** Monto en moneda funcional (montoConvertido del registro de caja). */
	montoFuncional: number;
	/** Moneda funcional del tenant; por defecto CUP (de la evidencia FX si aplica). */
	monedaFuncionalCodigo?: string | null;
	tasaCambio?: number | null;
	fxEvidenceFingerprint?: string | null;
	/** Tipo de cuenta destino: EFECTIVO → CAJA; resto → BANCOS. */
	tipoCuenta?: string | null;
	referencia?: string;
}

/**
 * @description Resuelve el medio de tesorería a partir del tipo de cuenta.
 * @param {string | null | undefined} tipoCuenta - Tipo de cuenta bancaria.
 * @returns {'CAJA' | 'BANCOS'} Medio de tesorería para la sustitución de rol.
 */
export function medioPorTipoCuenta(tipoCuenta?: string | null): 'CAJA' | 'BANCOS' {
	return tipoCuenta === 'EFECTIVO' ? 'CAJA' : 'BANCOS';
}

/**
 * @description Evento VENTA_CONTADO anclado a la reconciliación de caja.
 */
export function buildEventoVentaContado(params: {
	reconciliacionId: string;
	descripcion?: string;
	fecha?: Date;
	tesoreria: ParamsTesoreria;
}): EventoContableInput {
	return {
		tipo: 'VENTA_CONTADO',
		fecha: params.fecha ?? new Date(),
		descripcion: params.descripcion ?? 'Venta al contado',
		origen: { tipo: 'reconciliacion_venta', id: params.reconciliacionId },
		monto: params.tesoreria.monto,
		moneda: params.tesoreria.moneda,
		montoFuncional: params.tesoreria.montoFuncional,
		monedaFuncional: params.tesoreria.monedaFuncionalCodigo ?? MONEDA_FUNCIONAL_DEFECTO,
		tasaCambio: params.tesoreria.tasaCambio ?? null,
		fxEvidenceFingerprint: params.tesoreria.fxEvidenceFingerprint ?? null,
		medioCobro: medioPorTipoCuenta(params.tesoreria.tipoCuenta),
		referencia: params.tesoreria.referencia,
	};
}

/**
 * @description Evento COBRO_CXC anclado a la reconciliación del cobro.
 */
export function buildEventoCobroCxc(params: {
	reconciliacionId: string;
	descripcion?: string;
	fecha?: Date;
	tesoreria: ParamsTesoreria;
}): EventoContableInput {
	return {
		...buildEventoVentaContado(params),
		tipo: 'COBRO_CXC',
		descripcion: params.descripcion ?? 'Cobro de cuenta por cobrar',
	};
}

/**
 * @description Evento VENTA_CREDITO anclado a la factura emitida a plazo.
 */
export function buildEventoVentaCredito(params: {
	facturaId: string;
	monto: number;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return {
		tipo: 'VENTA_CREDITO',
		fecha: params.fecha ?? new Date(),
		descripcion: params.descripcion ?? 'Venta a crédito',
		origen: { tipo: 'factura', id: params.facturaId },
		monto: params.monto,
		moneda: MONEDA_FUNCIONAL_DEFECTO,
		montoFuncional: params.monto,
		monedaFuncional: MONEDA_FUNCIONAL_DEFECTO,
		tasaCambio: null,
		fxEvidenceFingerprint: null,
		referencia: params.referencia,
	};
}

/**
 * @description Evento COSTO_VENTA_DEVENGADO: el costo FIFO se expresa en moneda
 * funcional y viaja como auxiliar; la línea de costo no lleva referencia cruzada.
 */
export function buildEventoCostoVenta(params: {
	ventaId: string;
	costoFifo: number;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return {
		tipo: 'COSTO_VENTA_DEVENGADO',
		fecha: params.fecha ?? new Date(),
		descripcion: params.descripcion ?? 'Costo de venta devengado',
		origen: { tipo: 'venta_costo', id: params.ventaId },
		monto: params.costoFifo,
		moneda: MONEDA_FUNCIONAL_DEFECTO,
		montoFuncional: params.costoFifo,
		monedaFuncional: MONEDA_FUNCIONAL_DEFECTO,
		tasaCambio: null,
		fxEvidenceFingerprint: null,
		referencia: params.referencia,
		auxiliares: { costoFifo: params.costoFifo },
	};
}

/** Tipo de evento de egreso resuelto por el workflow de pago de gastos. */
export type TipoEventoEgreso =
	| 'PAGO_CXP'
	| 'PAGO_NOMINA'
	| 'COMPRA_CONTADO'
	| 'GASTO_CONTADO';

const DESCRIPCION_EGRESO: Record<TipoEventoEgreso, string> = {
	PAGO_CXP: 'Pago de cuenta por pagar',
	PAGO_NOMINA: 'Pago de nómina',
	COMPRA_CONTADO: 'Compra al contado',
	GASTO_CONTADO: 'Gasto al contado',
};

/**
 * @description Evento de egreso (pago a proveedores, nómina, compra o gasto al
 * contado) anclado a la reconciliación de gasto generada por el workflow.
 */
export function buildEventoEgreso(params: {
	tipo: TipoEventoEgreso;
	reconciliacionId: string;
	descripcion?: string;
	fecha?: Date;
	tesoreria: ParamsTesoreria;
}): EventoContableInput {
	const base = buildEventoVentaContado({
		reconciliacionId: params.reconciliacionId,
		descripcion: params.descripcion,
		fecha: params.fecha,
		tesoreria: params.tesoreria,
	});
	return {
		...base,
		tipo: params.tipo,
		descripcion: params.descripcion ?? DESCRIPCION_EGRESO[params.tipo],
		origen: { tipo: 'reconciliacion_gasto', id: params.reconciliacionId },
	};
}

/**
 * @description Evento COMPRA_CREDITO anclado al documento de compra (CxP creada).
 */
export function buildEventoCompraCredito(params: {
	compraId: string;
	monto: number;
	moneda?: string;
	montoFuncional?: number;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return {
		tipo: 'COMPRA_CREDITO',
		fecha: params.fecha ?? new Date(),
		descripcion: params.descripcion ?? 'Compra a crédito',
		origen: { tipo: 'compra_documento', id: params.compraId },
		monto: params.monto,
		moneda: params.moneda ?? MONEDA_FUNCIONAL_DEFECTO,
		montoFuncional: params.montoFuncional ?? params.monto,
		monedaFuncional: MONEDA_FUNCIONAL_DEFECTO,
		tasaCambio: null,
		fxEvidenceFingerprint: null,
		referencia: params.referencia,
	};
}

/**
 * @description Evento GASTO_CON_ANTICIPO_PROVEEDOR: el gasto se liquida con
 * fondos del anticipo (sin movimiento bancario): D gasto / H anticipos proveedor.
 */
export function buildEventoGastoConAnticipoProveedor(params: {
	reconciliacionId: string;
	descripcion?: string;
	fecha?: Date;
	tesoreria: Omit<ParamsTesoreria, 'tipoCuenta'>;
}): EventoContableInput {
	const base = buildEventoVentaContado({
		reconciliacionId: params.reconciliacionId,
		descripcion: params.descripcion,
		fecha: params.fecha,
		tesoreria: params.tesoreria,
	});
	return {
		...base,
		tipo: 'GASTO_CON_ANTICIPO_PROVEEDOR',
		descripcion: params.descripcion ?? 'Gasto liquidado con anticipo a proveedor',
		origen: { tipo: 'reconciliacion_gasto', id: params.reconciliacionId },
		medioCobro: undefined,
	};
}

export { MONEDA_FUNCIONAL_DEFECTO };

/**
 * @description Discrimina el evento de egreso según el destino del pago en el
 * workflow de gastos. Prioridad: CxP → nómina → compra → gasto genérico.
 * @param {object} params - Referencias del workflow de pago de gastos.
 * @returns {TipoEventoEgreso} Tipo de evento contable resultante.
 */
export function resolverTipoEventoEgreso(params: {
	cuentaPorPagarId?: string | null;
	pgId?: string | null;
	gastoCompraId?: string | null;
}): TipoEventoEgreso {
	if (params.cuentaPorPagarId) return 'PAGO_CXP';
	if (params.pgId) return 'PAGO_NOMINA';
	if (params.gastoCompraId) return 'COMPRA_CONTADO';
	return 'GASTO_CONTADO';
}

/** Parámetros de valoración para eventos no ligados a la cuenta destino. */
interface ValoracionBase {
	monto: number;
	moneda: string;
	montoFuncional?: number;
	monedaFuncionalCodigo?: string | null;
	tasaCambio?: number | null;
	fxEvidenceFingerprint?: string | null;
}

/**
 * @description Base común de evento con valoración funcional.
 */
function baseEvento(
	tipo: EventoContableInput['tipo'],
	origen: { tipo: string; id: string },
	valoracion: ValoracionBase,
	extra?: Partial<EventoContableInput>,
): EventoContableInput {
	return {
		tipo,
		fecha: extra?.fecha ?? new Date(),
		descripcion: extra?.descripcion ?? tipo,
		origen,
		monto: valoracion.monto,
		moneda: valoracion.moneda,
		montoFuncional: valoracion.montoFuncional ?? valoracion.monto,
		monedaFuncional: valoracion.monedaFuncionalCodigo ?? MONEDA_FUNCIONAL_DEFECTO,
		tasaCambio: valoracion.tasaCambio ?? null,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint ?? null,
		...extra,
	} as EventoContableInput;
}

/** Evento TRANSFERENCIA_BANCARIA entre cuentas del tenant. */
export function buildEventoTransferenciaBancaria(params: {
	transferenciaId: string;
	montoOrigen: number;
	monedaOrigen: string;
	montoDestino: number;
	monedaDestino: string;
	tasaCambio?: number | null;
	referencia?: string;
	descripcion?: string;
	fecha?: Date;
}): EventoContableInput {
	return baseEvento(
		'TRANSFERENCIA_BANCARIA',
		{ tipo: 'transferencia_bancaria', id: params.transferenciaId },
		{
			monto: params.montoOrigen,
			moneda: params.monedaOrigen,
			montoFuncional: params.monedaDestino === MONEDA_FUNCIONAL_DEFECTO ? params.montoDestino : params.montoOrigen,
			tasaCambio: params.tasaCambio ?? null,
		},
		{
			descripcion: params.descripcion ?? 'Transferencia entre cuentas',
			referencia: params.referencia,
			fecha: params.fecha,
		},
	);
}

/** Evento AJUSTE_BANCARIO_ABONO (ingreso) o _CARGO (egreso). */
export function buildEventoAjusteBancario(params: {
	ajusteId: string;
	tipo: 'ingreso' | 'egreso';
	valoracion: ValoracionBase;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	const cargo = params.tipo === 'egreso';
	return baseEvento(
		cargo ? 'AJUSTE_BANCARIO_CARGO' : 'AJUSTE_BANCARIO_ABONO',
		{ tipo: 'ajuste_bancario', id: params.ajusteId },
		params.valoracion,
		{
			descripcion:
				params.descripcion ??
				(cargo ? 'Ajuste bancario de cargo' : 'Ajuste bancario de abono'),
			referencia: params.referencia,
			fecha: params.fecha,
		},
	);
}

/** Evento INYECCION_CAPITAL (aporte de socios). */
export function buildEventoInyeccionCapital(params: {
	inyeccionId: string;
	valoracion: ValoracionBase;
	tipoCuenta?: string | null;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		'INYECCION_CAPITAL',
		{ tipo: 'inyeccion_capital', id: params.inyeccionId },
		params.valoracion,
		{
			descripcion: params.descripcion ?? 'Inyección de capital',
			referencia: params.referencia,
			fecha: params.fecha,
			medioCobro: medioPorTipoCuenta(params.tipoCuenta),
		},
	);
}

/** Evento PAGO_DEUDA_CAPITAL (devolución de aporte de capital). */
export function buildEventoPagoDeudaCapital(params: {
	pagoDeudaId: string;
	valoracion: ValoracionBase;
	tipoCuenta?: string | null;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		'PAGO_DEUDA_CAPITAL',
		{ tipo: 'pago_deuda_capital', id: params.pagoDeudaId },
		params.valoracion,
		{
			descripcion: params.descripcion ?? 'Pago de deuda de capital',
			referencia: params.referencia,
			fecha: params.fecha,
			medioCobro: medioPorTipoCuenta(params.tipoCuenta),
		},
	);
}

/** Evento PRESTAMO_OTORGADO (desembolso). */
export function buildEventoPrestamoOtorgado(params: {
	prestamoId: string;
	valoracion: ValoracionBase;
	tipoCuenta?: string | null;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		'PRESTAMO_OTORGADO',
		{ tipo: 'prestamo_cash', id: params.prestamoId },
		params.valoracion,
		{
			descripcion: params.descripcion ?? 'Desembolso de préstamo',
			referencia: params.referencia,
			fecha: params.fecha,
			medioCobro: medioPorTipoCuenta(params.tipoCuenta),
		},
	);
}

/** Evento COBRO_PRESTAMO con descomposición capital/intereses si se conoce. */
export function buildEventoCobroPrestamo(params: {
	reconciliacionId: string;
	valoracion: ValoracionBase;
	intereses?: number | null;
	tipoCuenta?: string | null;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		'COBRO_PRESTAMO',
		{ tipo: 'reconciliacion_venta', id: params.reconciliacionId },
		params.valoracion,
		{
			descripcion: params.descripcion ?? 'Cobro de préstamo',
			referencia: params.referencia,
			fecha: params.fecha,
			medioCobro: medioPorTipoCuenta(params.tipoCuenta),
			auxiliares:
				params.intereses && params.intereses > 0
					? { intereses: params.intereses }
					: undefined,
		},
	);
}

/** Evento DEUDA_RECIBIDA (préstamo de proveedor/tercero que entra a caja). */
export function buildEventoDeudaRecibida(params: {
	deudaId: string;
	valoracion: ValoracionBase;
	tipoCuenta?: string | null;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		'DEUDA_RECIBIDA',
		{ tipo: 'deuda_cash', id: params.deudaId },
		params.valoracion,
		{
			descripcion: params.descripcion ?? 'Deuda recibida',
			referencia: params.referencia,
			fecha: params.fecha,
			medioCobro: medioPorTipoCuenta(params.tipoCuenta),
		},
	);
}

/** Evento PAGO_DEUDA (salida). */
export function buildEventoPagoDeuda(params: {
	reconciliacionId: string;
	valoracion: ValoracionBase;
	intereses?: number | null;
	tipoCuenta?: string | null;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		'PAGO_DEUDA',
		{ tipo: 'reconciliacion_venta', id: params.reconciliacionId },
		params.valoracion,
		{
			descripcion: params.descripcion ?? 'Pago de deuda',
			referencia: params.referencia,
			fecha: params.fecha,
			medioCobro: medioPorTipoCuenta(params.tipoCuenta),
			auxiliares:
				params.intereses && params.intereses > 0
					? { intereses: params.intereses }
					: undefined,
		},
	);
}

/** Evento de creación de anticipo: recibido (cliente) o entregado (proveedor). */
export function buildEventoAnticipoCreado(params: {
	anticipoId: string;
	tipo: 'COBRO' | 'PAGO';
	valoracion: ValoracionBase;
	tipoCuenta?: string | null;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		params.tipo === 'COBRO' ? 'ANTICIPO_CLIENTE_RECIBIDO' : 'ANTICIPO_PROVEEDOR_ENTREGADO',
		{ tipo: 'anticipo', id: params.anticipoId },
		params.valoracion,
		{
			descripcion:
				params.descripcion ??
				(params.tipo === 'COBRO'
					? 'Anticipo recibido de cliente'
					: 'Anticipo entregado a proveedor'),
			referencia: params.referencia,
			fecha: params.fecha,
			medioCobro: medioPorTipoCuenta(params.tipoCuenta),
		},
	);
}

/** Evento de aplicación de anticipo sobre venta (cliente) o compra (proveedor). */
export function buildEventoAnticipoAplicado(params: {
	movimientoId: string;
	tipo: 'CLIENTE' | 'PROVEEDOR';
	valoracion: ValoracionBase;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		params.tipo === 'CLIENTE'
			? 'ANTICIPO_CLIENTE_APLICADO'
			: 'ANTICIPO_PROVEEDOR_APLICADO',
		{ tipo: 'anticipo_movimiento', id: params.movimientoId },
		params.valoracion,
		{
			descripcion:
				params.descripcion ??
				(params.tipo === 'CLIENTE'
					? 'Anticipo de cliente aplicado a venta'
					: 'Anticipo de proveedor aplicado a compra'),
			referencia: params.referencia,
			fecha: params.fecha,
		},
	);
}

/** Evento VENTA_SERVICIO o COBRO_SERVICIO. */
export function buildEventoServicio(params: {
	cobro: boolean;
	reconciliacionId: string;
	tesoreria: ParamsTesoreria;
	descripcion?: string;
	fecha?: Date;
}): EventoContableInput {
	const base = buildEventoVentaContado({
		reconciliacionId: params.reconciliacionId,
		descripcion: params.descripcion,
		fecha: params.fecha,
		tesoreria: params.tesoreria,
	});
	return {
		...base,
		tipo: params.cobro ? 'COBRO_SERVICIO' : 'VENTA_SERVICIO',
		origen: { tipo: 'reconciliacion_servicio', id: params.reconciliacionId },
	};
}

/** Evento MERMA_INVENTARIO por el costo de la mercadería dada de baja. */
export function buildEventoMerma(params: {
	mermaId: string;
	costo: number;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		'MERMA_INVENTARIO',
		{ tipo: 'merma', id: params.mermaId },
		{ monto: params.costo, moneda: MONEDA_FUNCIONAL_DEFECTO, montoFuncional: params.costo },
		{
			descripcion: params.descripcion ?? 'Merma de inventario',
			referencia: params.referencia,
			fecha: params.fecha,
		},
	);
}

/** Evento PRODUCCION_SALIDA por el costo de ingredientes consumidos. */
export function buildEventoProduccionSalida(params: {
	ordenId: string;
	costo: number;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return baseEvento(
		'PRODUCCION_SALIDA',
		{ tipo: 'orden_produccion', id: params.ordenId },
		{ monto: params.costo, moneda: MONEDA_FUNCIONAL_DEFECTO, montoFuncional: params.costo },
		{
			descripcion: params.descripcion ?? 'Salida de producción',
			referencia: params.referencia,
			fecha: params.fecha,
		},
	);
}

/**
 * @description Evento DEVOLUCION_VENTA: reversa del ingreso por el total de la
 * devolución y, si hay costo restaurado FIFO > 0, reversa del costo (líneas 3-4).
 */
export function buildEventoDevolucionVenta(params: {
	devolucionId: string;
	total: number;
	tasaCambio?: number | null;
	costoFifoRestaurado?: number;
	descripcion?: string;
	fecha?: Date;
	referencia?: string;
}): EventoContableInput {
	return {
		tipo: 'DEVOLUCION_VENTA',
		fecha: params.fecha ?? new Date(),
		descripcion: params.descripcion ?? 'Devolución de venta',
		origen: { tipo: 'devolucion_venta', id: params.devolucionId },
		monto: params.total,
		moneda: MONEDA_FUNCIONAL_DEFECTO,
		montoFuncional: params.total,
		monedaFuncional: MONEDA_FUNCIONAL_DEFECTO,
		tasaCambio: params.tasaCambio ?? null,
		fxEvidenceFingerprint: null,
		referencia: params.referencia,
		auxiliares:
			params.costoFifoRestaurado != null
				? { costoFifo: params.costoFifoRestaurado }
				: undefined,
	};
}
