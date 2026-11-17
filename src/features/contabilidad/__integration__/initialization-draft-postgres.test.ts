import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { computeInitializationPayloadHash, guardarBorradorInicializacion, obtenerBorradorInicializacion, runIdempotentInitialization } from '@/features/contabilidad/services/initialization-idempotency';

const tenantA = 'tenant-draft-a';
const tenantB = 'tenant-draft-b';
const tenantC = 'tenant-draft-c';
const key = 'draft-key-pg';

const draftPayload = {
  fechaCorte: '2026-11-01',
  monedaFuncional: 'CUP',
  cuentas: [{ numeroCuenta: 'QA-001', nombreCuenta: 'Caja', nombreBanco: 'Banco QA', tipoCuenta: 'Ahorros', moneda: 'CUP', saldoInicial: '100000' }],
};
const finalPayload = {
  ...draftPayload,
  cuentas: [{ ...draftPayload.cuentas[0], origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA' } }],
};

describe('borrador reanudable (PostgreSQL)', () => {
  beforeAll(async () => {
    await prisma.tenant.createMany({ data: [{ tenantId: tenantA, nombre: 'Draft A' }, { tenantId: tenantB, nombre: 'Draft B' }, { tenantId: tenantC, nombre: 'Draft C' }], skipDuplicates: true });
  });

  afterAll(async () => {
    await prisma.inicializacionContable.deleteMany({ where: { tenantId: { in: [tenantA, tenantB, tenantC] } } });
    await prisma.tenant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB, tenantC] } } });
  });

  it('guarda, retoma y confirma un borrador con la misma clave', async () => {
    const saved = await guardarBorradorInicializacion({ tenantId: tenantA, idempotencyKey: key, borrador: draftPayload });
    expect(saved).toMatchObject({ idempotencyKey: key, estado: 'BORRADOR' });
    const resumed = await obtenerBorradorInicializacion({ tenantId: tenantA, idempotencyKey: key });
    expect(resumed?.borrador).toMatchObject({ fechaCorte: '2026-11-01', cuentas: [{ numeroCuenta: 'QA-001' }] });

    const result = await runIdempotentInitialization(
      { tenantId: tenantA, idempotencyKey: key, payloadHash: computeInitializationPayloadHash(finalPayload) },
      async () => ({ periodoId: 'periodo-a' }),
    );
    expect(result).toEqual({ replayed: false, resultado: { periodoId: 'periodo-a' } });
    const row = await prisma.inicializacionContable.findFirst({ where: { tenantId: tenantA } });
    expect(row?.estado).toBe('COMPLETADA');
    expect(row?.borrador).toMatchObject({ fechaCorte: '2026-11-01' });
  });

  it('una confirmación fallida mantiene el borrador para retomarlo', async () => {
    const failed = () => runIdempotentInitialization(
      { tenantId: tenantB, idempotencyKey: key, payloadHash: computeInitializationPayloadHash(finalPayload) },
      async () => { throw new Error('Fallo de conciliación'); },
    );
    await guardarBorradorInicializacion({ tenantId: tenantB, idempotencyKey: key, borrador: draftPayload });
    await expect(failed()).rejects.toThrow('Fallo de conciliación');
    const row = await prisma.inicializacionContable.findFirst({ where: { tenantId: tenantB } });
    expect(row?.estado).toBe('BORRADOR');
    const resumed = await obtenerBorradorInicializacion({ tenantId: tenantB, idempotencyKey: key });
    expect(resumed?.borrador).toMatchObject({ cuentas: [{ numeroCuenta: 'QA-001' }] });
  });

  it('una confirmación con otra clave tras el borrador entra en conflicto', async () => {
    await expect(runIdempotentInitialization(
      { tenantId: tenantB, idempotencyKey: 'otra-clave', payloadHash: computeInitializationPayloadHash(finalPayload) },
      async () => ({ periodoId: 'periodo-b' }),
    )).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('dos guardados concurrentes con la misma clave dejan una sola fila', async () => {
    const results = await Promise.allSettled([
      guardarBorradorInicializacion({ tenantId: tenantC, idempotencyKey: 'concurrent-key', borrador: draftPayload }),
      guardarBorradorInicializacion({ tenantId: tenantC, idempotencyKey: 'concurrent-key', borrador: { ...draftPayload, fechaCorte: '2026-11-02' } }),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const count = await prisma.inicializacionContable.count({ where: { tenantId: tenantC } });
    expect(count).toBe(1);
  });
});
