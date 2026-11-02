import type { DecimalInput, EventoContableInput } from '../services/posting-engine';
import type { TipoEventoClave } from './plan-default';

export type AnticipoEventType =
	| 'ANTICIPO_CLIENTE_RECIBIDO'
	| 'ANTICIPO_CLIENTE_APLICADO'
	| 'ANTICIPO_PROVEEDOR_ENTREGADO'
	| 'ANTICIPO_PROVEEDOR_APLICADO'
	| 'ANTICIPO_CLIENTE_APLICACION_REVERSADA'
	| 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA'
	| 'ANTICIPO_CLIENTE_DEVUELTO'
	| 'ANTICIPO_PROVEEDOR_REINTEGRADO';

export interface AnticipoEventParams {
	anticipoMovimientoId: string;
	tipo: AnticipoEventType;
	fecha: Date;
	monto: DecimalInput;
	moneda: string;
	montoFuncional: DecimalInput;
	monedaFuncional: string;
	tasaCambio?: DecimalInput | null;
	fxEvidenceFingerprint?: string | null;
	diferenciaFx?: DecimalInput;
	treasuryAccountType?: string | null;
	descripcion?: string;
}

/**
 * @description Construye un evento formal de origen o aplicación de anticipo.
 * @param {AnticipoEventParams} params - Movimiento y valoración persistidos.
 * @returns {EventoContableInput} Evento anclado al movimiento del anticipo.
 */
export function buildAnticipoEvent(params: AnticipoEventParams): EventoContableInput {
	const esCliente = params.tipo.startsWith('ANTICIPO_CLIENTE');
	const esCobroEfectivo = params.tipo === 'ANTICIPO_CLIENTE_RECIBIDO';
	const esPagoEfectivo = params.tipo === 'ANTICIPO_PROVEEDOR_ENTREGADO';
	const esReverso = params.tipo.endsWith('REVERSADA');
	const esAplicacion = params.tipo.includes('_APLICADO') || esReverso;
	const esDevolucion = params.tipo === 'ANTICIPO_CLIENTE_DEVUELTO' ||
		params.tipo === 'ANTICIPO_PROVEEDOR_REINTEGRADO';
	const esEfectivo = esCobroEfectivo || esPagoEfectivo || esDevolucion;
	const medioCobro = params.treasuryAccountType === 'EFECTIVO' ? 'CAJA' : 'BANCOS';

	return {
		tipo: params.tipo as TipoEventoClave,
		fecha: params.fecha,
		descripcion:
			params.descripcion ??
			(esCobroEfectivo
				? 'Recepción de anticipo de cliente'
			: esPagoEfectivo
					? 'Entrega de anticipo a proveedor'
				: params.tipo === 'ANTICIPO_CLIENTE_DEVUELTO'
					? 'Devolución de anticipo a cliente'
					: params.tipo === 'ANTICIPO_PROVEEDOR_REINTEGRADO'
						? 'Reintegro de anticipo por proveedor'
				: esReverso
					? esCliente
						? 'Reverso de aplicación de anticipo de cliente'
						: 'Reverso de aplicación de anticipo a proveedor'
					: esCliente
						? 'Aplicación de anticipo de cliente'
						: 'Aplicación de anticipo a proveedor'),
		origen: { tipo: 'anticipo_movimiento', id: params.anticipoMovimientoId },
		monto: params.monto,
		moneda: params.moneda,
		montoFuncional: params.montoFuncional,
		monedaFuncional: params.monedaFuncional,
		tasaCambio: params.tasaCambio ?? null,
		fxEvidenceFingerprint: params.fxEvidenceFingerprint ?? null,
		...(esAplicacion || !esEfectivo || !params.treasuryAccountType ? {} : { medioCobro }),
		auxiliares: { diferenciaFx: params.diferenciaFx ?? 0 },
	};
}
