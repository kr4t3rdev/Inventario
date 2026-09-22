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
