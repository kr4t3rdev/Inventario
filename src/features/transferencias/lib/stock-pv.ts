/**
 * Fila de transferencia relevante para el cálculo de stock de un punto de
 * venta.
 */
export interface FilaAporteTransferencia {
	estado: string;
	cantidad: number;
	cantidadRecibida: number | null;
}

/**
 * @description Calcula las unidades que una transferencia movió del stock.
 * Es la fuente única de verdad: una COMPLETADA movió su cantidad (o lo
 * recibido cuando la fila se recibió por partes, que es el caso de las filas
 * heredadas sin backfill), una PARCIAL movió solo lo recibido y una
 * transferencia sin recepción (PENDIENTE, APROBADA, EN_TRANSITO) no movió
 * nada. Se usa tanto para calcular el aporte al stock de un punto de venta
 * como para revertir el stock al cancelar, de modo que ambos caminos no
 * puedan divergir.
 * @param {FilaAporteTransferencia} fila - Fila de transferencia con estado,
 * cantidad enviada y cantidad recibida.
 * @returns {number} Unidades que la transferencia movió del stock.
 */
export function calcularUnidadesMovidas(fila: FilaAporteTransferencia): number {
	if (fila.estado === "COMPLETADA") {
		return fila.cantidadRecibida ?? fila.cantidad;
	}
	if (fila.estado === "PARCIAL") {
		return fila.cantidadRecibida ?? 0;
	}
	return 0;
}

/**
 * @description Calcula las unidades que un conjunto de transferencias aportó
 * al stock de un punto de venta. Con el flujo de la Sesión B el stock solo se
 * mueve al recibir, así que manda lo recibido y no lo enviado: una COMPLETADA
 * de creación directa (cantidadRecibida null) movió todo su stock al crearse y
 * aporta su cantidad; una PARCIAL aporta solo lo recibido; una transferencia
 * sin recepción (PENDIENTE, APROBADA, EN_TRANSITO) aún no movió stock y no
 * aporta nada.
 * @param {FilaAporteTransferencia[]} filas - Filas de transferencias hacia o
 * desde el punto de venta, ya filtradas por estado y borrado lógico.
 * @returns {number} Unidades que esas filas movieron del stock del PV.
 */
export function calcularAporteRecibido(
	filas: FilaAporteTransferencia[],
): number {
	return filas.reduce((total, fila) => total + calcularUnidadesMovidas(fila), 0);
}
