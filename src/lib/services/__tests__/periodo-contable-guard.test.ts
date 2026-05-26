/**
 * @description Tests unitarios del guard de períodos contables.
 *
 * Cubre: feature flag (disabled/audit-only/enforce), caché hit/miss/expired,
 * validación de escritura, wrapper withPeriodValidation, y extraerFechaNegocio.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock de Prisma (usando vi.hoisted) ──

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    periodoContable: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditoriaPeriodo: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    periodoCache: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// ── Imports bajo test ─────────────────────────────────────────────────────

import {
  PeriodoGuard,
  getGuardConfigExtended,
  extraerFechaNegocio,
  cachearPeriodoActivo,
  obtenerPeriodoCache,
  invalidateCache,
  clearCache,
} from '@/lib/services/periodo-contable-guard';
import {
  EstadoPeriodo,
  TipoPeriodo,
  type ResolverPeriodoResult,
} from '@/lib/services/periodo-contable-types';
import { ActionError } from '@/lib/server-actions/types';

// ── Helpers ───────────────────────────────────────────────────────────────

const TENANT = 'tenant-1';
const ACTOR = 'user-1';

function makeResolverResult(overrides: Record<string, unknown> = {}): ResolverPeriodoResult {
  return {
    periodo: {
      periodoId: 'p-1',
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-01T00:00:00Z'),
      fechaFin: new Date('2026-03-31T23:59:59Z'),
      label: 'Marzo 2026',
    },
    estado: EstadoPeriodo.ABIERTO,
    esWritable: true,
    ...overrides,
  };
}

function makeGuard(overrides: { mode?: 'disabled' | 'audit-only' | 'enforce'; enabled?: boolean } = {}) {
  return new PeriodoGuard({
    mode: overrides.mode ?? 'enforce',
    enabled: overrides.enabled ?? true,
    defaultTimezone: 'America/Argentina/Buenos_Aires',
  });
}

function resetEnv() {
  delete process.env.PERIODO_CONTABLE_MODE;
  delete process.env.PERIODO_GUARD_ENABLED;
  delete process.env.PERIODO_CONTABLE_TIMEZONE;
}

// ── Tests: modo disabled ─────────────────────────────────────────────────

describe('modo disabled', () => {
  beforeEach(async () => {
    await clearCache();
    resetEnv();
    vi.clearAllMocks();
  });

  it('no valida — retorna ok inmediatamente', async () => {
    const guard = makeGuard({ mode: 'disabled', enabled: false });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-02-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(true);
    expect(result.modo).toBe('disabled');
    // No debería consultar la DB
    expect(mockPrisma.periodoContable.findFirst).not.toHaveBeenCalled();
  });

  it('enabled=false fuerza modo disabled', async () => {
    const guard = makeGuard({ mode: 'enforce', enabled: false });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-02-15'),
      tenantId: TENANT,
      tipoOperacion: 'caja',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(true);
    expect(result.modo).toBe('disabled');
  });
});

// ── Tests: modo audit-only ───────────────────────────────────────────────

describe('modo audit-only', () => {
  beforeEach(async () => {
    await clearCache();
    resetEnv();
    vi.clearAllMocks();
  });

  it('logea violación pero permite escritura en período cerrado', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.CERRADO,
      fechaInicio: new Date('2026-02-01'),
      fechaFin: new Date('2026-02-28'),
    });

    const guard = makeGuard({ mode: 'audit-only' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-02-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(true);
    expect(result.modo).toBe('audit-only');
  });

  it('permite si no existe período', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const guard = makeGuard({ mode: 'audit-only' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-06-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(true);
    expect(result.modo).toBe('audit-only');
  });

  it('permite período abierto normalmente', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    });

    const guard = makeGuard({ mode: 'audit-only' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-03-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(true);
    expect(result.modo).toBe('audit-only');
  });
});

// ── Tests: modo enforce ──────────────────────────────────────────────────

describe('modo enforce', () => {
  beforeEach(async () => {
    await clearCache();
    resetEnv();
    vi.clearAllMocks();
  });

  it('bloquea período cerrado', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.CERRADO,
      fechaInicio: new Date('2026-02-01'),
      fechaFin: new Date('2026-02-28'),
    });

    const guard = makeGuard({ mode: 'enforce' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-02-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(false);
    expect(result.codigo).toBe('PERIODO_CERRADO');
    expect(result.error).toContain('cerrado');
    expect(result.modo).toBe('enforce');
  });

  it('bloquea período aprobado', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.APROBADO,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2026-01-31'),
    });

    const guard = makeGuard({ mode: 'enforce' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-01-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(false);
    expect(result.codigo).toBe('PERIODO_APROBADO');
    expect(result.error).toContain('aprobado');
  });

  it('bloquea período en cierre', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.EN_CIERRE,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    });

    const guard = makeGuard({ mode: 'enforce' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-03-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(false);
    expect(result.codigo).toBe('PERIODO_EN_CIERRE');
    expect(result.error).toContain('cierre');
  });

  it('bloquea período en borrador', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.BORRADOR,
      fechaInicio: new Date('2026-04-01'),
      fechaFin: new Date('2026-04-30'),
    });

    const guard = makeGuard({ mode: 'enforce' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-04-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(false);
    expect(result.codigo).toBe('PERIODO_CERRADO');
  });

  it('permite período abierto', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    });

    const guard = makeGuard({ mode: 'enforce' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-03-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.modo).toBe('enforce');
  });

  it('permite período reabierto', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.REABIERTO,
      fechaInicio: new Date('2026-02-01'),
      fechaFin: new Date('2026-02-28'),
    });

    const guard = makeGuard({ mode: 'enforce' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-02-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(true);
  });

  it('error si tenant no tiene período (PERIODO_NO_EXISTE)', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const guard = makeGuard({ mode: 'enforce' });

    const result = await guard.verificarEscritura({
      fecha: new Date('2026-06-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(false);
    expect(result.codigo).toBe('PERIODO_NO_EXISTE');
    expect(result.error).toContain('No existe un período');
  });
});

// ── Tests: Caché ─────────────────────────────────────────────────────────

describe('caché de período activo (PostgreSQL)', () => {
  beforeEach(() => {
    resetEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function cacheKey(tenantId: string, fecha: Date): string {
    const dia = fecha.toISOString().split('T')[0];
    return `${tenantId}:${dia}`;
  }

  function makeCacheEntry(tenantId: string, fecha: Date, ttlMs = 60_000) {
    return {
      cacheKey: cacheKey(tenantId, fecha),
      tenantId,
      fecha,
      resultadoJson: makeResolverResult(),
      expiresAt: new Date(Date.now() + ttlMs),
    };
  }

  it('cache hit evita query a DB', async () => {
    const fecha = new Date('2026-03-15');
    mockPrisma.periodoCache.findUnique.mockResolvedValue(makeCacheEntry(TENANT, fecha));

    const guard = makeGuard({ mode: 'enforce' });
    const result = await guard.verificarEscritura({
      fecha,
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(result.permitido).toBe(true);
    // No debería haber consultado la DB porque usó el caché
    expect(mockPrisma.periodoContable.findFirst).not.toHaveBeenCalled();
  });

  it('cache miss hace query a DB', async () => {
    mockPrisma.periodoCache.findUnique.mockResolvedValue(null);
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    });

    const guard = makeGuard({ mode: 'enforce' });
    await guard.verificarEscritura({
      fecha: new Date('2026-03-15'),
      tenantId: TENANT,
      tipoOperacion: 'devengo',
      actor: ACTOR,
    });

    expect(mockPrisma.periodoContable.findFirst).toHaveBeenCalled();
  });

  it('cache TTL invalida después de 30s', async () => {
    vi.useFakeTimers();

    const fecha = new Date('2026-03-15');
    // Mock cache con expiresAt = ahora + 30s
    mockPrisma.periodoCache.findUnique.mockResolvedValue(
      makeCacheEntry(TENANT, fecha, 30_000),
    );

    // Verificar que el caché funciona
    const cached = await obtenerPeriodoCache(TENANT, fecha);
    expect(cached).not.toBeNull();

    // Avanzar 31 segundos
    vi.advanceTimersByTime(31_000);

    // El caché debería haber expirado (findUnique no es llamado de nuevo
    // porque delete ya fue llamado; mockeamos null para la próxima llamada)
    const expired = await obtenerPeriodoCache(TENANT, fecha);
    expect(expired).toBeNull();

    // Verificar que llamó delete por expiración
    expect(mockPrisma.periodoCache.delete).toHaveBeenCalledWith({
      where: { cacheKey: cacheKey(TENANT, fecha) },
    });
  });

  it('invalidateCache borra entradas del tenant', async () => {
    const fecha1 = new Date('2026-03-15');
    const fecha2 = new Date('2026-03-20');

    // Mockear entradas en caché para ambos findUnique
    mockPrisma.periodoCache.findUnique
      .mockResolvedValueOnce(makeCacheEntry(TENANT, fecha1))
      .mockResolvedValueOnce(makeCacheEntry(TENANT, fecha2));

    // Verificar que existen (cada get llama a findUnique)
    expect(await obtenerPeriodoCache(TENANT, fecha1)).not.toBeNull();
    expect(await obtenerPeriodoCache(TENANT, fecha2)).not.toBeNull();

    // Invalidar vía deleteMany
    await invalidateCache(TENANT);

    // Después de invalidar, findUnique devuelve null
    mockPrisma.periodoCache.findUnique.mockResolvedValue(null);

    expect(await obtenerPeriodoCache(TENANT, fecha1)).toBeNull();
    expect(await obtenerPeriodoCache(TENANT, fecha2)).toBeNull();

    // Verificar que llamó deleteMany con el tenant correcto
    expect(mockPrisma.periodoCache.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
    });
  });

  it('invalidateCache no borra entradas de otro tenant', async () => {
    const fecha = new Date('2026-03-15');

    // Caché para ambos tenants
    mockPrisma.periodoCache.findUnique
      .mockResolvedValueOnce(makeCacheEntry(TENANT, fecha))
      .mockResolvedValueOnce(makeCacheEntry('tenant-2', fecha));

    expect(await obtenerPeriodoCache(TENANT, fecha)).not.toBeNull();
    expect(await obtenerPeriodoCache('tenant-2', fecha)).not.toBeNull();

    // Reset mocks and invalidate
    mockPrisma.periodoCache.findUnique.mockReset();
    await invalidateCache(TENANT);

    // Después de invalidar, solo TENANT debe estar vacío
    mockPrisma.periodoCache.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCacheEntry('tenant-2', fecha));

    expect(await obtenerPeriodoCache(TENANT, fecha)).toBeNull();
    expect(await obtenerPeriodoCache('tenant-2', fecha)).not.toBeNull();

    // deleteMany solo llamado para TENANT
    expect(mockPrisma.periodoCache.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
    });
  });
});

// ── Tests: getGuardConfigExtended ────────────────────────────────────────

describe('getGuardConfigExtended', () => {
  beforeEach(() => {
    resetEnv();
  });

  it('retorna defaults cuando no hay env vars', () => {
    const config = getGuardConfigExtended();

    expect(config.enabled).toBe(true);
    expect(config.mode).toBe('enforce');
    expect(config.defaultTimezone).toBe('America/Argentina/Buenos_Aires');
  });

  it('respeta PERIODO_GUARD_ENABLED=false → mode disabled', () => {
    process.env.PERIODO_GUARD_ENABLED = 'false';

    const config = getGuardConfigExtended();

    expect(config.enabled).toBe(false);
    expect(config.mode).toBe('disabled');
  });

  it('respeta PERIODO_CONTABLE_MODE=audit-only', () => {
    process.env.PERIODO_CONTABLE_MODE = 'audit-only';

    const config = getGuardConfigExtended();

    expect(config.mode).toBe('audit-only');
    expect(config.enabled).toBe(true);
  });

  it('respeta PERIODO_CONTABLE_TIMEZONE', () => {
    process.env.PERIODO_CONTABLE_TIMEZONE = 'America/New_York';

    const config = getGuardConfigExtended();

    expect(config.defaultTimezone).toBe('America/New_York');
  });

  it('normaliza modo inválido a disabled', () => {
    process.env.PERIODO_CONTABLE_MODE = 'invalid-mode';

    const config = getGuardConfigExtended();

    expect(config.mode).toBe('disabled');
  });
});

// ── Tests: extraerFechaNegocio ───────────────────────────────────────────

describe('extraerFechaNegocio', () => {
  it('extrae fecha del campo "fecha"', () => {
    const input = { fecha: '2026-03-15T00:00:00Z', nombre: 'test' };
    const result = extraerFechaNegocio(input);
    expect(result).toEqual(new Date('2026-03-15T00:00:00Z'));
  });

  it('extrae fecha del campo "fechaCompra"', () => {
    const input = { fechaCompra: '2026-02-20T00:00:00Z' };
    const result = extraerFechaNegocio(input);
    expect(result).toEqual(new Date('2026-02-20T00:00:00Z'));
  });

  it('extrae fecha del campo "fechaServicio"', () => {
    const input = { fechaServicio: '2026-01-10T00:00:00Z' };
    const result = extraerFechaNegocio(input);
    expect(result).toEqual(new Date('2026-01-10T00:00:00Z'));
  });

  it('extrae fecha del campo "fechaReconciliacion"', () => {
    const input = { fechaReconciliacion: '2026-03-15T00:00:00Z' };
    const result = extraerFechaNegocio(input);
    expect(result).toEqual(new Date('2026-03-15T00:00:00Z'));
  });

  it('extrae fecha del campo "fechaTransferencia"', () => {
    const input = { fechaTransferencia: '2026-04-01T00:00:00Z' };
    const result = extraerFechaNegocio(input);
    expect(result).toEqual(new Date('2026-04-01T00:00:00Z'));
  });

  it('extrae fecha del campo "fechaPago"', () => {
    const input = { fechaPago: '2026-05-20T00:00:00Z' };
    const result = extraerFechaNegocio(input);
    expect(result).toEqual(new Date('2026-05-20T00:00:00Z'));
  });

  it('prioriza "fecha" sobre otros campos', () => {
    const input = {
      fecha: '2026-03-15T00:00:00Z',
      fechaCompra: '2026-02-20T00:00:00Z',
    };
    const result = extraerFechaNegocio(input);
    expect(result).toEqual(new Date('2026-03-15T00:00:00Z'));
  });

  it('extrae Date object directamente', () => {
    const date = new Date('2026-06-01T00:00:00Z');
    const input = { fecha: date };
    const result = extraerFechaNegocio(input);
    expect(result).toEqual(date);
  });

  it('retorna null para input no-objeto', () => {
    expect(extraerFechaNegocio(null)).toBeNull();
    expect(extraerFechaNegocio(undefined)).toBeNull();
    expect(extraerFechaNegocio('string')).toBeNull();
    expect(extraerFechaNegocio(42)).toBeNull();
  });

  it('retorna null para objeto sin campos de fecha', () => {
    const input = { nombre: 'test', monto: 100 };
    const result = extraerFechaNegocio(input);
    expect(result).toBeNull();
  });

  it('retorna null para fecha inválida', () => {
    const input = { fecha: 'not-a-date' };
    const result = extraerFechaNegocio(input);
    expect(result).toBeNull();
  });
});

// ── Tests: withPeriodValidation wrapper ──────────────────────────────────

describe('withPeriodValidation wrapper', () => {
  beforeEach(() => {
    clearCache();
    resetEnv();
    vi.clearAllMocks();
  });

  it('ejecuta handler si el período es abierto', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    });

    const guard = makeGuard({ mode: 'enforce' });
    const handler = vi.fn().mockResolvedValue({ success: true, data: { id: 1 } });

    const wrapped = PeriodoGuard.withPeriodValidation(
      guard,
      (args: { fecha: string }) => new Date(args.fecha),
      handler,
    );

    const user = { userId: ACTOR, tenantId: TENANT, name: 'Test', email: 'test@test.com', role: 'admin' as const, isActive: true };
    const result = await wrapped({ fecha: '2026-03-15' }, user);

    expect(handler).toHaveBeenCalledWith({ fecha: '2026-03-15' }, user);
    expect(result).toEqual({ success: true, data: { id: 1 } });
  });

  it('lanza ActionError si el período está cerrado', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.CERRADO,
      fechaInicio: new Date('2026-02-01'),
      fechaFin: new Date('2026-02-28'),
    });

    const guard = makeGuard({ mode: 'enforce' });
    const handler = vi.fn().mockResolvedValue({ success: true });

    const wrapped = PeriodoGuard.withPeriodValidation(
      guard,
      (args: { fecha: string }) => new Date(args.fecha),
      handler,
    );

    const user = { userId: ACTOR, tenantId: TENANT, name: 'Test', email: 'test@test.com', role: 'admin' as const, isActive: true };

    await expect(wrapped({ fecha: '2026-02-15' }, user)).rejects.toThrow(ActionError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('no aplica guard si no hay fecha en el input', async () => {
    const guard = makeGuard({ mode: 'enforce' });
    const handler = vi.fn().mockResolvedValue({ success: true });

    const wrapped = PeriodoGuard.withPeriodValidation(
      guard,
      (_args: { nombre: string }) => null,
      handler,
    );

    const user = { userId: ACTOR, tenantId: TENANT, name: 'Test', email: 'test@test.com', role: 'admin' as const, isActive: true };
    const result = await wrapped({ nombre: 'test' }, user);

    expect(handler).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
    expect(mockPrisma.periodoContable.findFirst).not.toHaveBeenCalled();
  });

  it('no aplica guard si el usuario no tiene tenantId', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.CERRADO,
      fechaInicio: new Date('2026-02-01'),
      fechaFin: new Date('2026-02-28'),
    });

    const guard = makeGuard({ mode: 'enforce' });
    const handler = vi.fn().mockResolvedValue({ success: true });

    const wrapped = PeriodoGuard.withPeriodValidation(
      guard,
      (args: { fecha: string }) => new Date(args.fecha),
      handler,
    );

    const user = { userId: ACTOR, name: 'Test', email: 'test@test.com', role: 'admin' as const, isActive: true };
    const result = await wrapped({ fecha: '2026-02-15' }, user);

    // Sin tenantId, el guard no se aplica
    expect(handler).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});

// ── Tests: assertWritable estático ───────────────────────────────────────

describe('assertWritable estático', () => {
  beforeEach(async () => {
    await clearCache();
    resetEnv();
    vi.clearAllMocks();
  });

  it('bloquea período cerrado', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.CERRADO,
      fechaInicio: new Date('2026-02-01'),
      fechaFin: new Date('2026-02-28'),
    });

    process.env.PERIODO_CONTABLE_MODE = 'enforce';

    const result = await PeriodoGuard.assertWritable(
      new Date('2026-02-15'),
      TENANT,
      'devengo',
    );

    expect(result.permitido).toBe(false);
    expect(result.codigo).toBe('PERIODO_CERRADO');
  });

  it('permite período abierto', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    });

    process.env.PERIODO_CONTABLE_MODE = 'enforce';

    const result = await PeriodoGuard.assertWritable(
      new Date('2026-03-15'),
      TENANT,
      'devengo',
    );

    expect(result.permitido).toBe(true);
  });
});

// ── Tests: checkWritable estático ────────────────────────────────────────

describe('checkWritable estático', () => {
  beforeEach(() => {
    clearCache();
    resetEnv();
    vi.clearAllMocks();
  });

  it('retorna passed=true para período abierto', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    });

    process.env.PERIODO_CONTABLE_MODE = 'enforce';

    const result = await PeriodoGuard.checkWritable(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.passed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('retorna passed=false con error para período cerrado', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'p-1',
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.CERRADO,
      fechaInicio: new Date('2026-02-01'),
      fechaFin: new Date('2026-02-28'),
    });

    process.env.PERIODO_CONTABLE_MODE = 'enforce';

    const result = await PeriodoGuard.checkWritable(
      new Date('2026-02-15'),
      TENANT,
    );

    expect(result.passed).toBe(false);
    expect(result.error?.code).toBe('PERIODO_CERRADO');
    expect(result.error?.message).toBeDefined();
  });
});
