/**
 * @description Guard central de escrituras contables.
 *
 * Intercepta TODA operación de escritura y verifica que el período correspondiente
 * esté en estado writable (ABIERTO o REABIERTO). Soporta tres modos:
 * - disabled: bypassa la validación completamente
 * - audit-only: valida, logea violaciones pero permite la operación
 * - enforce: valida, logea violaciones y bloquea la operación
 *
 * Usa un caché compartido en PostgreSQL (tabla periodo_cache) para que múltiples
 * instancias de la aplicación compartan el mismo estado. Cada entrada tiene un
 * TTL de 30 segundos definido por expiresAt.
 */

import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions/types';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { PeriodoContableService } from './periodo-contable-service';
import {
  EstadoPeriodo,
  getGuardConfig,
  type GuardConfig,
  type PeriodoContableResumen,
  type ResolverPeriodoResult,
} from './periodo-contable-types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface GuardConfigExtended extends GuardConfig {
  defaultTimezone: string;
}

export interface VerificarEscrituraParams {
  fecha: Date;
  tenantId: string;
  tipoOperacion: string;
  actor: string;
  metadata?: Record<string, unknown>;
}

export interface VerificarEscrituraResult {
  permitido: boolean;
  error?: string;
  codigo?: string;
  modo: string;
}

// ── Cache de período activo (PostgreSQL compartido) ──────────────────────

const CACHE_TTL_MS = 30_000; // 30 segundos

/**
 * Genera la clave de caché para un tenant y fecha.
 */
function cacheKey(tenantId: string, fecha: Date): string {
  // Usamos la fecha truncada al día para agrupar consultas del mismo día
  const dia = fecha.toISOString().split('T')[0];
  return `${tenantId}:${dia}`;
}

/**
 * Cachea el resultado de resolución de período para un tenant y fecha.
 * Usa upsert sobre la tabla PostgreSQL `periodo_cache` para que
 * todas las instancias compartan el mismo estado.
 *
 * @param {string} tenantId - ID del tenant.
 * @param {Date} fecha - Fecha de negocio.
 * @param {ResolverPeriodoResult} resultado - Resultado a cachear.
 */
export async function cachearPeriodoActivo(
  tenantId: string,
  fecha: Date,
  resultado: ResolverPeriodoResult,
): Promise<void> {
  const key = cacheKey(tenantId, fecha);
  await prisma.periodoCache.upsert({
    where: { cacheKey: key },
    create: {
      cacheKey: key,
      tenantId,
      fecha,
      resultadoJson: resultado as Record<string, unknown>,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
    update: {
      resultadoJson: resultado as Record<string, unknown>,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });
}

/**
 * Obtiene el período cacheado para un tenant y fecha desde PostgreSQL.
 *
 * @param {string} tenantId - ID del tenant.
 * @param {Date} fecha - Fecha de negocio.
 * @returns {Promise<ResolverPeriodoResult | null>} Resultado cacheado o null si no existe o expiró.
 */
export async function obtenerPeriodoCache(
  tenantId: string,
  fecha: Date,
): Promise<ResolverPeriodoResult | null> {
  const key = cacheKey(tenantId, fecha);
  const entry = await prisma.periodoCache.findUnique({
    where: { cacheKey: key },
  });

  if (!entry) return null;

  // Si expiró, borrar y retornar null
  if (new Date() > entry.expiresAt) {
    await prisma.periodoCache.delete({ where: { cacheKey: key } });
    return null;
  }

  return entry.resultadoJson as unknown as ResolverPeriodoResult;
}

/**
 * Invalida el caché de períodos para un tenant específico.
 * Se llama después de apertura/cierre/reapertura de un período.
 *
 * @param {string} tenantId - ID del tenant.
 */
export async function invalidateCache(tenantId: string): Promise<void> {
  await prisma.periodoCache.deleteMany({
    where: { tenantId },
  });
}

/**
 * Invalida todo el caché (útil para tests).
 */
export async function clearCache(): Promise<void> {
  await prisma.periodoCache.deleteMany({});
}

/**
 * Limpia las entradas expiradas del caché.
 * Puede llamarse periódicamente desde un cron o al inicio del guard.
 *
 * @returns {Promise<number>} Cantidad de entradas eliminadas.
 */
export async function limpiarCacheExpirado(): Promise<number> {
  const result = await prisma.periodoCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// ── PeriodoAuditService stub (se implementa en T3) ───────────────────────

/**
 * Interfaz mínima del audit service para el guard.
 * Se implementará completamente en T3.
 */
export interface PeriodoAuditServiceStub {
  registrar(params: {
    periodoId: string;
    tenantId: string;
    evento: string;
    actor: string;
    motivo?: string;
    entidadAfectada?: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
}

// ── PeriodoGuard ──────────────────────────────────────────────────────────

/**
 * @description Guard central que intercepta escrituras contables.
 *
 * Verifica que el período correspondiente a una fecha esté en estado writable
 * antes de permitir la operación. Soporta modos disabled, audit-only y enforce.
 */
export class PeriodoGuard {
  constructor(
    private config: GuardConfigExtended,
    private auditService?: PeriodoAuditServiceStub | null,
  ) {}

  /**
   * Método principal: verifica si una operación puede escribirse en la fecha dada.
   *
   * - disabled: retorna ok sin validar
   * - audit-only: valida, logea si viola, pero retorna ok
   * - enforce: valida, logea si viola, y retorna error
   *
   * @param {VerificarEscrituraParams} params - Parámetros de la operación.
   * @returns {Promise<VerificarEscrituraResult>} Resultado de la validación.
   */
  async verificarEscritura(params: VerificarEscrituraParams): Promise<VerificarEscrituraResult> {
    const { fecha, tenantId, tipoOperacion, actor, metadata } = params;

    // Modo disabled: bypass completo
    if (this.config.mode === 'disabled' || !this.config.enabled) {
      console.warn(
        '[PeriodoGuard] GUARD DISABLED — bypassando validación de período. ' +
        `tenantId=${tenantId}, fecha=${fecha.toISOString()}`,
      );
      return { permitido: true, modo: 'disabled' };
    }

    // Resolver período (cache → DB)
    const resultado = await this._resolverConCache(fecha, tenantId);

    // No existe período
    if (resultado.estado === 'NO_EXISTE') {
      const error = 'No existe un período contable para esta fecha. Creá un período primero.';
      await this._registrarIntentoBypass(tenantId, actor, error, { fecha: fecha.toISOString(), tipoOperacion, ...metadata });
      if (this.config.mode === 'enforce') {
        return { permitido: false, error, codigo: 'PERIODO_NO_EXISTE', modo: 'enforce' };
      }
      // audit-only: logea pero permite
      console.warn(`[PeriodoGuard] AUDIT-ONLY — ${error}`);
      return { permitido: true, modo: 'audit-only' };
    }

    // Período existe pero no es writable
    if (!resultado.esWritable) {
      const periodo = resultado.periodo as PeriodoContableResumen;
      const code = this._estadoToErrorCode(resultado.estado as EstadoPeriodo);
      const error = this._buildErrorMessage(resultado.estado as EstadoPeriodo, periodo);

      await this._registrarIntentoBypass(tenantId, actor, error, {
        periodoId: periodo.periodoId,
        estado: resultado.estado,
        fecha: fecha.toISOString(),
        tipoOperacion,
        ...metadata,
      });

      if (this.config.mode === 'enforce') {
        return { permitido: false, error, codigo: code, modo: 'enforce' };
      }

      // audit-only: logea pero permite
      console.warn(`[PeriodoGuard] AUDIT-ONLY — ${error}`);
      return { permitido: true, modo: 'audit-only' };
    }

    // Período writable — todo ok
    return { permitido: true, modo: this.config.mode };
  }

  /**
   * Versión estática para uso directo sin instanciación.
   * Lee la configuración de variables de entorno.
   *
   * @param {Date} fecha - Fecha de negocio.
   * @param {string} tenantId - ID del tenant.
   * @param {string} [tipoOperacion] - Tipo de operación.
   * @returns {Promise<VerificarEscrituraResult>} Resultado de la validación.
   */
  static async assertWritable(
    fecha: Date,
    tenantId: string,
    tipoOperacion?: string,
  ): Promise<VerificarEscrituraResult> {
    const config = getGuardConfigExtended();
    const guard = new PeriodoGuard(config);
    return guard.verificarEscritura({
      fecha,
      tenantId,
      tipoOperacion: tipoOperacion ?? 'devengo',
      actor: 'system',
    });
  }

  /**
   * Versión que retorna resultado sin lanzar error (para audit-only).
   *
   * @param {Date} fecha - Fecha de negocio.
   * @param {string} tenantId - ID del tenant.
   * @param {string} [tipoOperacion] - Tipo de operación.
   * @returns {Promise<{ passed: boolean; error?: { code: string; message: string } }>}
   */
  static async checkWritable(
    fecha: Date,
    tenantId: string,
    tipoOperacion?: string,
  ): Promise<{ passed: boolean; error?: { code: string; message: string } }> {
    const result = await this.assertWritable(fecha, tenantId, tipoOperacion);
    if (result.permitido) {
      return { passed: true };
    }
    return {
      passed: false,
      error: {
        code: result.codigo ?? 'PERIODO_ERROR',
        message: result.error ?? 'Error de período',
      },
    };
  }

  /**
   * Wrapper para Server Actions: envuelve el handler con validación de período.
   *
   * @template T - Tipo del input de la Server Action.
   * @param {PeriodoGuard} guard - Instancia del guard.
   * @param {(args: T) => Date} extraerFecha - Función que extrae la fecha del input.
   * @param {(args: T, user: AuthenticatedUser) => Promise<any>} handler - Handler original.
   * @returns {(args: T, user: AuthenticatedUser) => Promise<any>} Handler envuelto.
   */
  static withPeriodValidation<T>(
    guard: PeriodoGuard,
    extraerFecha: (args: T) => Date | null,
    handler: (args: T, user: AuthenticatedUser) => Promise<any>,
  ): (args: T, user: AuthenticatedUser) => Promise<any> {
    return async (args: T, user: AuthenticatedUser) => {
      const fecha = extraerFecha(args);

      if (fecha && user.tenantId) {
        const result = await guard.verificarEscritura({
          fecha,
          tenantId: user.tenantId,
          tipoOperacion: 'devengo',
          actor: user.userId,
        });

        if (!result.permitido) {
          throw new ActionError(result.error ?? 'Período no permite escrituras', result.codigo);
        }
      }

      return handler(args, user);
    };
  }

  // ── Helpers internos ────────────────────────────────────────────────────

  /**
   * Resuelve el período activo usando caché primero, DB como fallback.
   */
  private async _resolverConCache(fecha: Date, tenantId: string): Promise<ResolverPeriodoResult> {
    // Intentar caché (PostgreSQL compartido)
    const cached = await obtenerPeriodoCache(tenantId, fecha);
    if (cached) {
      return cached;
    }

    // Query a DB
    const resultado = await PeriodoContableService.resolverPeriodoActivo(fecha, tenantId);

    // Cachear resultado
    await cachearPeriodoActivo(tenantId, fecha, resultado);

    return resultado;
  }

  /**
   * Registra un intento de bypass en auditoría (si el audit service está disponible).
   */
  private async _registrarIntentoBypass(
    tenantId: string,
    actor: string,
    mensaje: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditService) return;

    try {
      await this.auditService.registrar({
        periodoId: 'N/A',
        tenantId,
        evento: 'INTENTO_BYPASS',
        actor,
        motivo: mensaje,
        payload,
      });
    } catch {
      // Si falla la auditoría, al menos logeamos
      console.error('[PeriodoGuard] Error registrando intento bypass:', mensaje);
    }
  }

  /**
   * Mapea un estado no-writable a su código de error.
   */
  private _estadoToErrorCode(estado: EstadoPeriodo): string {
    switch (estado) {
      case EstadoPeriodo.CERRADO:
        return 'PERIODO_CERRADO';
      case EstadoPeriodo.APROBADO:
        return 'PERIODO_APROBADO';
      case EstadoPeriodo.EN_CIERRE:
        return 'PERIODO_EN_CIERRE';
      case EstadoPeriodo.BORRADOR:
        return 'PERIODO_CERRADO';
      default:
        return 'PERIODO_CERRADO';
    }
  }

  /**
   * Construye el mensaje de error legible para el usuario.
   */
  private _buildErrorMessage(estado: EstadoPeriodo, periodo: PeriodoContableResumen): string {
    const label = periodo.label;
    switch (estado) {
      case EstadoPeriodo.CERRADO:
        return `El período ${periodo.tipo} ${label} está cerrado. No se permiten modificaciones.`;
      case EstadoPeriodo.APROBADO:
        return `El período ${periodo.tipo} ${label} está aprobado. Debe reaperturarse con motivo para modificar.`;
      case EstadoPeriodo.EN_CIERRE:
        return `El período ${periodo.tipo} ${label} está en proceso de cierre. Intente más tarde.`;
      case EstadoPeriodo.BORRADOR:
        return `El período ${periodo.tipo} ${label} está en borrador. No permite escrituras.`;
      default:
        return `El período ${periodo.tipo} ${label} está en estado ${estado}. No permite escrituras.`;
    }
  }
}

// ── Feature Flag ──────────────────────────────────────────────────────────

/**
 * Lee la configuración del feature flag desde variables de entorno.
 * Combina PERIODO_GUARD_ENABLED y PERIODO_CONTABLE_MODE.
 */
export function getGuardConfigExtended(): GuardConfigExtended {
  const base = getGuardConfig();
  const mode = base.enabled ? base.mode : 'disabled';
  const validModes: GuardConfigExtended['mode'][] = ['disabled', 'audit-only', 'enforce'];
  const normalizedMode = validModes.includes(mode as GuardConfigExtended['mode'])
    ? (mode as GuardConfigExtended['mode'])
    : 'disabled';

  return {
    enabled: base.enabled,
    mode: normalizedMode,
    defaultTimezone: process.env.PERIODO_CONTABLE_TIMEZONE || 'America/Argentina/Buenos_Aires',
  };
}

/**
 * Extrae la fecha de negocio del input de una Server Action.
 * Busca campos conocidos por convención.
 *
 * @param {unknown} input - Input de la Server Action.
 * @returns {Date | null} Fecha encontrada o null.
 */
export function extraerFechaNegocio(input: unknown): Date | null {
  if (!input || typeof input !== 'object') return null;

  const obj = input as Record<string, unknown>;

  // Prioridad: fecha explícita de negocio > fechaReconciliacion > createdAt
  const fechaFields = [
    'fecha',
    'fechaCompra',
    'fechaServicio',
    'fechaReconciliacion',
    'fechaTransferencia',
    'fechaPago',
    'fechaAnticipo',
    'fechaVencimiento',
  ];

  for (const field of fechaFields) {
    const val = obj[field];
    if (val && typeof val === 'string') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    if (val instanceof Date && !isNaN(val.getTime())) return val;
  }

  return null;
}
