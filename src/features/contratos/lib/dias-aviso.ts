/**
 * @description Resolver de días de aviso de vencimiento de contratos (CTF-5):
 *              precedencia por contrato > configuración del tenant > default 30.
 *              Compartido por la UI (badge de vencimiento) y el cron de alertas.
 * @module features/contratos/lib/dias-aviso
 */

/**
 * @description Resuelve los días de aviso aplicables a un contrato.
 * @param {{ diasAvisoVencimiento?: number | null }} contrato - Contrato con su aviso por contrato (opcional).
 * @param {{ diasAvisoVencimiento: number } | null | undefined} configTenant - Fila de ConfiguracionContratos del tenant (opcional).
 * @returns {number} Días de aviso vigentes (siempre > 0).
 */
export function resolverDiasAviso(
  contrato: { diasAvisoVencimiento?: number | null },
  configTenant?: { diasAvisoVencimiento: number } | null,
): number {
  if (contrato.diasAvisoVencimiento != null && contrato.diasAvisoVencimiento > 0) {
    return contrato.diasAvisoVencimiento;
  }
  if (configTenant?.diasAvisoVencimiento != null && configTenant.diasAvisoVencimiento > 0) {
    return configTenant.diasAvisoVencimiento;
  }
  return 30;
}
