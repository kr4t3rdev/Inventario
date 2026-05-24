/**
 * @description Tipos, enums e interfaces compartidos para el módulo de períodos contables.
 *
 * Define los estados, transiciones válidas, error codes y contratos de datos
 * que usan el servicio de dominio, el guard y las Server Actions.
 */

import { EstadoPeriodo, TipoPeriodo, EventoAuditoria } from '@/generated/prisma';
import type { PeriodoContable } from '@/generated/prisma';

// ── Re-export de enums de Prisma para uso en TypeScript puro ─────────────

export { EstadoPeriodo, TipoPeriodo, EventoAuditoria };

// ── Estados que permiten escritura contable ──────────────────────────────

/**
 * Solo los períodos en estos estados aceptan operaciones contables.
 */
export const WRITABLE_STATES: EstadoPeriodo[] = [
  EstadoPeriodo.ABIERTO,
  EstadoPeriodo.REABIERTO,
];

// ── Matriz de transiciones válidas ───────────────────────────────────────

/**
 * Define qué transiciones de estado están permitidas.
 * Cada estado mapea a un array de estados destino válidos.
 */
export const VALID_TRANSITIONS: Record<EstadoPeriodo, EstadoPeriodo[]> = {
  BORRADOR: [EstadoPeriodo.ABIERTO],
  ABIERTO: [EstadoPeriodo.EN_CIERRE, EstadoPeriodo.CERRADO], // CERRADO directo para V1
  EN_CIERRE: [EstadoPeriodo.CERRADO],
  CERRADO: [EstadoPeriodo.APROBADO],
  APROBADO: [EstadoPeriodo.REABIERTO],
  REABIERTO: [EstadoPeriodo.EN_CIERRE, EstadoPeriodo.ABIERTO],
};

// ── Error codes del guard y servicio ─────────────────────────────────────

export type PeriodoErrorCode =
  | 'PERIODO_CERRADO'
  | 'PERIODO_APROBADO'
  | 'PERIODO_EN_CIERRE'
  | 'PERIODO_NO_EXISTE'
  | 'PERIODO_SOLAPADO'
  | 'PERIODO_YA_ABIERTO'
  | 'TRANSICION_INVALIDA'
  | 'MOTIVO_REAPERTURA_REQUERIDO'
  | 'HIJOS_ABIERTOS'
  | 'GUARD_DISABLED';

/**
 * Resumen ligero de un período contable (sin campos internos).
 */
export interface PeriodoContableResumen {
  periodoId: string;
  tipo: TipoPeriodo;
  estado: EstadoPeriodo;
  fechaInicio: Date;
  fechaFin: Date;
  label: string; // ej: "Marzo 2026"
}

/**
 * Error de dominio para operaciones de período contable.
 */
export class PeriodoError extends Error {
  code: PeriodoErrorCode;
  periodo?: PeriodoContableResumen;

  constructor(message: string, code: PeriodoErrorCode, periodo?: PeriodoContableResumen) {
    super(message);
    this.name = 'PeriodoError';
    this.code = code;
    this.periodo = periodo;
  }
}

// ── Feature Flag ─────────────────────────────────────────────────────────

export type FeatureFlagMode = 'disabled' | 'audit-only' | 'enforce';

export interface GuardConfig {
  enabled: boolean;
  mode: FeatureFlagMode;
}

/**
 * Lee la configuración del feature flag desde variables de entorno.
 */
export function getGuardConfig(): GuardConfig {
  const enabled = process.env.PERIODO_GUARD_ENABLED !== 'false';
  const mode = (process.env.PERIODO_CONTABLE_MODE ?? 'enforce') as FeatureFlagMode;
  return { enabled, mode };
}

// ── Resultado de resolución de período ───────────────────────────────────

export interface ResolverPeriodoResult {
  periodo: PeriodoContableResumen | null;
  estado: EstadoPeriodo | 'NO_EXISTE';
  esWritable: boolean;
}

// ── Resultado de validación de escritura ─────────────────────────────────

export interface ValidacionResult {
  permitido: boolean;
  error?: PeriodoError;
  periodo?: PeriodoContableResumen;
}

// ── Input para crear período ─────────────────────────────────────────────

export interface CreatePeriodoInput {
  tenantId: string;
  tipo: TipoPeriodo;
  fechaInicio: Date;
  fechaFin: Date;
  observaciones?: string;
}

// ── Snapshot totales ─────────────────────────────────────────────────────

export interface SnapshotTotales {
  totalCuentas: number;
  totalSaldos: Record<string, number>; // moneda → saldo total
  cuentas: {
    cuentaBancariaId: string;
    nombreBanco: string;
    numeroCuenta: string;
    saldo: number;
    moneda: string;
  }[];
}

// ── Entry de auditoría ───────────────────────────────────────────────────

export interface AuditEntry {
  auditoriaId: string;
  evento: EventoAuditoria;
  actor: string;
  timestamp: Date;
  motivo?: string;
  payload?: Record<string, unknown>;
  entidadAfectada?: string;
}

// ── Tipo de operación contable (para el guard) ───────────────────────────

export type TipoOperacionContable = 'caja' | 'devengo';

// ── Helpers de utilidad ──────────────────────────────────────────────────

/**
 * Genera un label legible para un período según su tipo y fechas.
 * Usa métodos UTC ya que las fechas se almacenan en UTC.
 */
export function generarLabelPeriodo(tipo: TipoPeriodo, fechaInicio: Date, fechaFin: Date): string {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  switch (tipo) {
    case TipoPeriodo.DIARIO: {
      const dia = fechaInicio.getUTCDate();
      const mes = meses[fechaInicio.getUTCMonth()];
      const anio = fechaInicio.getUTCFullYear();
      return `${dia} ${mes} ${anio}`;
    }
    case TipoPeriodo.MENSUAL: {
      const mes = meses[fechaInicio.getUTCMonth()];
      const anio = fechaInicio.getUTCFullYear();
      return `${mes} ${anio}`;
    }
    case TipoPeriodo.ANUAL: {
      const anio = fechaInicio.getUTCFullYear();
      return `Año ${anio}`;
    }
    default: {
      const anio = fechaInicio.getUTCFullYear();
      return `Período ${anio}`;
    }
  }
}

/**
 * Convierte un PeriodoContable de Prisma a PeriodoContableResumen.
 */
export function toResumen(periodo: PeriodoContable): PeriodoContableResumen {
  return {
    periodoId: periodo.periodoId,
    tipo: periodo.tipo as TipoPeriodo,
    estado: periodo.estado as EstadoPeriodo,
    fechaInicio: periodo.fechaInicio,
    fechaFin: periodo.fechaFin,
    label: generarLabelPeriodo(periodo.tipo as TipoPeriodo, periodo.fechaInicio, periodo.fechaFin),
  };
}
