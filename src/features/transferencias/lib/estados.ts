/**
 * @description Helpers puros del flujo de estados de transferencias.
 * Compartidos por la tabla y el diálogo para decidir qué acciones muestra la UI;
 * la autoridad real vive en las server actions (requirePermission).
 */
import type { EstadoTransferencia } from "@/app/models/model";

/** Estados desde los que se puede confirmar recepción (transición a COMPLETADA o PARCIAL). */
export const ESTADOS_RECEPCION_PERMITIDOS = [
	"APROBADA",
	"EN_TRANSITO",
	"PARCIAL",
] as const;

/** Estados desde los que se puede despachar (transición a EN_TRANSITO). */
export const ESTADOS_DESPACHO_PERMITIDOS = ["APROBADA"] as const;

/**
 * @description Indica si una transferencia puede despacharse (APROBADA → EN_TRANSITO).
 * @param {EstadoTransferencia} estado - Estado actual de la transferencia.
 * @returns {boolean} true si el despacho está disponible.
 */
export function puedeDespachar(estado: EstadoTransferencia): boolean {
	return (ESTADOS_DESPACHO_PERMITIDOS as readonly string[]).includes(estado);
}

/**
 * @description Indica si una transferencia admite confirmar recepción (total o parcial).
 * @param {EstadoTransferencia} estado - Estado actual de la transferencia.
 * @returns {boolean} true si la recepción está disponible.
 */
export function puedeConfirmarRecepcion(estado: EstadoTransferencia): boolean {
	return (ESTADOS_RECEPCION_PERMITIDOS as readonly string[]).includes(estado);
}
