import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
let prisma: typeof import('@/lib/prisma').prisma;
let persist: typeof import('@/features/contabilidad/services/initial-receivables-persistence').persistInitialReceivables;
let tenantA = '';
let tenantB = '';
let clientA = '';
let initA = '';
let initB = '';
let currencyCreated = false;
const input = () => ({
  tenantId: tenantA, inicializacionId: initA,
  cuentas: [{ referenciaFila: 'fila-1', clienteId: clientA, moneda: 'CUP', saldo: '125.25' }],
});

describe('persistencia CxC iniciales en PostgreSQL aislado', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).prisma;
    persist = (await import('@/features/contabilidad/services/initial-receivables-persistence')).persistInitialReceivables;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'CUP' } }))) {
      await prisma.moneda.create({ data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' } });
      currencyCreated = true;
    }
    tenantA = (await prisma.tenant.create({ data: { nombre: 'QA CxC A', slug: randomUUID() } })).tenantId;
    tenantB = (await prisma.tenant.create({ data: { nombre: 'QA CxC B', slug: randomUUID() } })).tenantId;
    clientA = (await prisma.cliente.create({ data: { tenantId: tenantA, nombre: 'Cliente QA' } })).clienteId;
    await prisma.tenantAccountingPolicy.create({ data: {
      tenantId: tenantA, functionalCurrencyCode: 'CUP', updatedBy: 'integration-test',
    } });
    initA = (await prisma.inicializacionContable.create({ data: {
      tenantId: tenantA, idempotencyKey: 'test', payloadHash: 'a'.repeat(64),
    } })).inicializacionId;
    initB = (await prisma.inicializacionContable.create({ data: {
      tenantId: tenantB, idempotencyKey: 'test', payloadHash: 'b'.repeat(64),
    } })).inicializacionId;
  });

  afterAll(async () => {
    if (!prisma) return;
    const tenants = [tenantA, tenantB].filter(Boolean);
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.inicializacionContable.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.cliente.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { tenantId: { in: tenants } } });
    if (currencyCreated) await prisma.moneda.delete({ where: { codigo: 'CUP' } });
    await prisma.$disconnect();
  });

  it('persiste solo el submayor, sin venta, factura, banco ni asiento', async () => {
    expect(await prisma.$transaction((tx) => persist(tx, input()))).toMatchObject({ count: 1, totalFuncional: '125.25' });
    const row = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId: tenantA } });
    expect(row).toMatchObject({ inicializacionId: initA, referenciaInicial: 'fila-1',
      tipoCuenta: 'APERTURA_EXTERNA', facturaId: null, ventaServicioId: null,
      monedaOriginal: 'CUP', monedaFuncional: 'CUP' });
    expect(row.montoDeuda.toString()).toBe('125.25');
    expect(row.montoDeudaFuncional?.toString()).toBe('125.25');
    expect(await prisma.venta.count({ where: { tenantId: tenantA } })).toBe(0);
    expect(await prisma.factura.count({ where: { tenantId: tenantA } })).toBe(0);
    expect(await prisma.cuentaBancaria.count({ where: { tenantId: tenantA } })).toBe(0);
    expect(await prisma.asiento.count({ where: { tenantId: tenantA } })).toBe(0);
  });

  it('rechaza una fila duplicada y no reemplaza la deuda previa', async () => {
    await expect(prisma.$transaction((tx) => persist(tx, input()))).rejects.toThrow();
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId: tenantA } })).toBe(1);
  });

  it('la FK rechaza asociar una inicialización de otro tenant', async () => {
    await expect(prisma.cuentaPorCobrar.create({ data: {
      tenantId: tenantA, clienteId: clientA, inicializacionId: initB, referenciaInicial: 'foreign',
      tipoCuenta: 'APERTURA_EXTERNA', montoDeuda: '1', monedaOriginal: 'CUP',
    } })).rejects.toThrow();
  });

  it('rechaza una CxC marcada como externa si falta su identidad de inicialización', async () => {
    await expect(prisma.$transaction(async (tx) => {
      await tx.cuentaPorCobrar.create({ data: {
        tenantId: tenantA, clienteId: clientA, tipoCuenta: 'APERTURA_EXTERNA', montoDeuda: '1',
      } });
      throw new Error('La base aceptó una CxC externa sin identidad');
    })).rejects.toThrow('CuentaPorCobrar_tipo_inicial_identidad_check');
  });

  it('no permite cambiar el origen, aunque montoPagado sigue siendo mutable sin coordinación', async () => {
    const row = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId: tenantA } });
    await expect(prisma.cuentaPorCobrar.update({ where: { id: row.id },
      data: { referenciaInicial: 'cambiada' } })).rejects.toThrow('El origen de la cuenta inicial es inmutable');
    await expect(prisma.cuentaPorCobrar.update({ where: { id: row.id },
      data: { montoPagado: '1' } })).resolves.toBeDefined();
  });

  it('revierte la CxC cuando falla la operación coordinadora', async () => {
    await expect(prisma.$transaction(async (tx) => {
      await persist(tx, { ...input(), cuentas: [{ ...input().cuentas[0], referenciaFila: 'rollback' }] });
      throw new Error('fallo de prueba');
    })).rejects.toThrow('fallo de prueba');
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId: tenantA, referenciaInicial: 'rollback' } })).toBe(0);
  });
  it('valora una deuda en divisa con la tasa de la tabla y guarda la evidencia FX', async () => {
    const result = await prisma.$transaction((tx) => persist(tx, {
      ...input(), fechaCorte: '2026-11-01', tasas: { USD: '24' },
      cuentas: [{ referenciaFila: 'fx-1', clienteId: clientA, moneda: 'USD', saldo: '100' }],
    }));
    expect(result).toMatchObject({ count: 1, totalFuncional: '2400' });
    const row = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId: tenantA, referenciaInicial: 'fx-1' } });
    expect(row.montoDeuda.toString()).toBe('100');
    expect(row.montoDeudaFuncional?.toString()).toBe('2400');
    expect(row.monedaOriginal).toBe('USD');
    expect(row.monedaFuncional).toBe('CUP');
    expect(row.tasaCambio?.toString()).toBe('24');
    expect(row.rateEffectiveAt?.toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(row.fxProvenanceKind).toBe('MANUAL_GOVERNED');
    expect(row.fxProvenanceSource).toBe('INICIALIZACION_CONTABLE');
    expect(row.fxEvidenceFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(row.fxEvidenceVersion).toBe(1);
    expect(row.fxEvidenceJson).toMatchObject({ fxProvenanceKind: 'MANUAL_GOVERNED', fxProvenanceSource: 'INICIALIZACION_CONTABLE' });
  });
  it('valora una deuda en divisa con la tasa de la fila', async () => {
    const result = await prisma.$transaction((tx) => persist(tx, {
      ...input(), fechaCorte: '2026-11-01',
      cuentas: [{ referenciaFila: 'fx-2', clienteId: clientA, moneda: 'USD', saldo: '100', tasaCambio: '25' }],
    }));
    expect(result).toMatchObject({ count: 1, totalFuncional: '2500' });
    const row = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId: tenantA, referenciaInicial: 'fx-2' } });
    expect(row.montoDeudaFuncional?.toString()).toBe('2500');
    expect(row.tasaCambio?.toString()).toBe('25');
  });
  it('rechaza divisa sin tasa declarada', async () => {
    await expect(prisma.$transaction((tx) => persist(tx, {
      ...input(), fechaCorte: '2026-11-01',
      cuentas: [{ referenciaFila: 'fx-sin-tasa', clienteId: clientA, moneda: 'USD', saldo: '100' }],
    }))).rejects.toThrow('divisa');
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId: tenantA, referenciaInicial: 'fx-sin-tasa' } })).toBe(0);
  });
});
