/**
 * @description Contrato de la moneda principal de una empresa. La única fuente
 * de verdad es la política contable del tenant
 * (`TenantAccountingPolicy.functionalCurrencyCode`); el catálogo de monedas y
 * sus marcas globales no definen la moneda principal de un tenant concreto.
 */

/** Estados posibles al resolver la moneda principal de una empresa. */
export type EstadoMonedaPrincipal = 'CONFIGURADA' | 'AUSENTE' | 'ERROR';

/** Resultado explícito de la resolución; nunca inventa una moneda. */
export interface ResultadoMonedaPrincipal {
  estado: EstadoMonedaPrincipal;
  /** Código normalizado en mayúsculas; null salvo estado CONFIGURADA. */
  moneda: string | null;
}

/** Cliente mínimo necesario para leer la política; inyectable en pruebas. */
export interface MonedaPrincipalClient {
  tenantAccountingPolicy: {
    findUnique(args: {
      where: { tenantId: string };
      select: { functionalCurrencyCode: true };
    }): Promise<{ functionalCurrencyCode: string } | null>;
  };
}

/**
 * @description Resuelve la moneda principal de una empresa desde su política
 * contable, con estados explícitos y sin sustituirla por CUP ni por la marca
 * global del catálogo. Un fallo de consulta se reporta como ERROR para que los
 * consumidores no presenten una moneda como si estuviera configurada.
 * @param {string} tenantId - Empresa propietaria de la política.
 * @param {MonedaPrincipalClient} client - Cliente de datos; por defecto prisma.
 * @returns {Promise<ResultadoMonedaPrincipal>} Estado y moneda normalizada.
 */
export async function resolverMonedaPrincipal(
  tenantId: string,
  client?: MonedaPrincipalClient,
): Promise<ResultadoMonedaPrincipal> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const db = client ?? (prisma as unknown as MonedaPrincipalClient);
    const policy = await db.tenantAccountingPolicy.findUnique({
      where: { tenantId },
      select: { functionalCurrencyCode: true },
    });
    const moneda = policy?.functionalCurrencyCode?.trim().toUpperCase() || null;
    if (!moneda) {
      return { estado: 'AUSENTE', moneda: null };
    }
    return { estado: 'CONFIGURADA', moneda };
  } catch (error) {
    console.error('No se pudo resolver la moneda principal de la empresa', {
      tenantId,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
    return { estado: 'ERROR', moneda: null };
  }
}
