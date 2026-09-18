/**
 * @description Construye un identificador determinista aislado por tenant para los seeds demo.
 * @param {string} seedId - Identificador estable del fixture.
 * @param {string} tenantId - Tenant propietario del fixture.
 * @returns {string} Identificador único dentro de la base completa.
 */
export function demoSeedId(seedId: string, tenantId: string): string {
  return `${seedId}__${tenantId}`;
}
