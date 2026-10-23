/**
 * Estados de cuentas por cobrar/pagar que siguen generando saldo pendiente.
 *
 * Fuente única compartida entre contabilidad (páginas de CxC/CxP del tenant) y
 * admin (consolidación global en /admin/finanzas) para que ambas pantallas
 * calculen el mismo saldo pendiente.
 *
 * - PENDIENTE y PARCIAL: suman saldo.
 * - PAGADA y ANULADA: no suman (CuentaPorPagar usa deletedAt como soft-delete
 *   en lugar de un estado ANULADA).
 */

export const ACTIVE_RECEIVABLE_STATES = ['PENDIENTE', 'PARCIAL'] as const;

export const ACTIVE_PAYABLE_STATES = ['PENDIENTE', 'PARCIAL'] as const;
