/**
 * @description Registro canónico de campos de fecha de operación por entidad contable.
 *
 * Cada entidad que participa en el cálculo de saldos de período tiene un campo
 * que representa la "fecha de operación" — cuándo ocurrió la transacción desde
 * la perspectiva contable.
 *
 * Este registro centraliza el mapeo para que el snapshot service, el period guard
 * y cualquier otro componente consulten siempre el campo correcto.
 *
 * Convención de nombres:
 * - Las reconciliaciones usan `fechaReconciliacion` (cuándo se reconcilió)
 * - Las transferencias usan `fechaTransferencia` (cuándo se transfirió)
 * - Los ajustes usan `createdAt` como fallback (no tienen campo específico)
 *
 * @see {@link SnapshotService._calcularSaldoCuenta}
 * @see {@link validarEscrituraPeriodo}
 */

/**
 * Tipos de entidad contable con fecha de operación canónica.
 */
export type EntidadContable =
  | 'reconciliacion_venta'
  | 'reconciliacion_servicio'
  | 'reconciliacion_gasto'
  | 'transferencia_bancaria'
  | 'ajuste_bancario';

/** Zona horaria contable usada para delimitar años y fechas de operación. */
export const ACCOUNTING_TIME_ZONE = 'America/Havana';

/**
 * @description Obtiene el año civil de un instante usando la zona contable única.
 * @param {Date} date - Instante UTC que se convertirá.
 * @returns {number} Año civil en la zona contable.
 */
export function getAccountingYear(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: ACCOUNTING_TIME_ZONE,
    year: 'numeric',
  }).format(date));
}

/**
 * Configuración del campo de fecha para una entidad.
 */
export interface FechaCampoConfig {
  /** Nombre del campo en el modelo Prisma */
  campo: string;
  /** Modo de contabilidad en que se usa este campo */
  modo: 'caja' | 'devengo' | 'ambos';
  /** Tabla/modelo Prisma */
  tabla: string;
  /** Notas sobre el campo */
  notas?: string;
}

/**
 * Mapa canónico: asocia cada entidad contable a su campo de fecha de operación.
 *
 * Para el modo 'caja', el snapshot service usa estos campos para determinar
 * si una transacción pertenece a un período.
 */
export const FECHA_OPERACION_POR_ENTIDAD: Record<EntidadContable, FechaCampoConfig> = {
  reconciliacion_venta: {
    campo: 'fechaReconciliacion',
    modo: 'caja',
    tabla: 'ReconciliacionVenta',
    notas: 'Fecha en que se reconcilió la venta con la cuenta bancaria',
  },
  reconciliacion_servicio: {
    campo: 'fechaReconciliacion',
    modo: 'caja',
    tabla: 'ReconciliacionServicio',
    notas: 'Fecha en que se reconcilió el servicio con la cuenta bancaria',
  },
  reconciliacion_gasto: {
    campo: 'fechaReconciliacion',
    modo: 'caja',
    tabla: 'ReconciliacionGasto',
    notas: 'Fecha en que se reconcilió el gasto con la cuenta bancaria',
  },
  transferencia_bancaria: {
    campo: 'fechaTransferencia',
    modo: 'caja',
    tabla: 'TransferenciaBancaria',
    notas: 'Fecha en que se ejecutó la transferencia',
  },
  ajuste_bancario: {
    campo: 'fechaOperacion',
    modo: 'devengo',
    tabla: 'AjusteBancario',
    notas: 'Fecha declarada por el usuario para el ajuste bancario',
  },
};

/**
 * Obtiene la configuración de fecha para una entidad contable.
 *
 * @param {EntidadContable} entidad - Tipo de entidad
 * @returns {FechaCampoConfig} Configuración del campo de fecha
 * @throws {Error} Si la entidad no está registrada
 */
export function getFechaConfig(entidad: EntidadContable): FechaCampoConfig {
  const config = FECHA_OPERACION_POR_ENTIDAD[entidad];
  if (!config) {
    throw new Error(`Entidad contable no registrada: ${entidad}`);
  }
  return config;
}

/**
 * Lista de todas las entidades contables con su campo de fecha,
 * para usar en filtros de agregación del snapshot service.
 */
export const ENTIDADES_CAJA = Object.entries(FECHA_OPERACION_POR_ENTIDAD)
  .filter(([, config]) => config.modo === 'caja' || config.modo === 'ambos')
  .map(([entidad, config]) => ({
    entidad: entidad as EntidadContable,
    campo: config.campo as string,
  }));

export const ENTIDADES_DEVENGO = Object.entries(FECHA_OPERACION_POR_ENTIDAD)
  .filter(([, config]) => config.modo === 'devengo' || config.modo === 'ambos')
  .map(([entidad, config]) => ({
    entidad: entidad as EntidadContable,
    campo: config.campo as string,
  }));
