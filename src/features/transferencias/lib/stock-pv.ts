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
	return filas.reduce((total, fila) => {
		if (fila.estado === "COMPLETADA") {
			return total + (fila.cantidadRecibida ?? fila.cantidad);
		}
		if (fila.estado === "PARCIAL") {
			return total + (fila.cantidadRecibida ?? 0);
		}
		return total;
	}, 0);
}
