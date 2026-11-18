import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
let prisma: typeof import('@/lib/prisma').prisma;
let persist: typeof import('@/features/contabilidad/services/initial-payables-persistence').persistInitialPayables;
let tenantA = '';
let tenantB = '';
let vendorA = '';
let vendorB = '';
let initA = '';
let initB = '';
let currencyCreated = false;
const input = () => ({
  tenantId: tenantA, inicializacionId: initA,
  cuentas: [{ referenciaFila: 'fila-1', proveedorId: vendorA, moneda: 'CUP', saldo: '125.25' }],
});

describe('persistencia CxP iniciales en PostgreSQL aislado', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).prisma;
    persist = (await import('@/features/contabilidad/services/initial-payables-persistence')).persistInitialPayables;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'CUP' } }))) {
      await prisma.moneda.create({ data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' } });
      currencyCreated = true;
    }
    tenantA = (await prisma.tenant.create({ data: { nombre: 'QA CxP A', slug: randomUUID() } })).tenantId;
    tenantB = (await prisma.tenant.create({ data: { nombre: 'QA CxP B', slug: randomUUID() } })).tenantId;
    vendorA = (await prisma.vendor.create({ data: { tenantId: tenantA, nombre: 'Proveedor QA A' } })).vendorId;
    vendorB = (await prisma.vendor.create({ data: { tenantId: tenantB, nombre: 'Proveedor QA B' } })).vendorId;
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
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.inicializacionContable.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.vendor.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { tenantId: { in: tenants } } });
    if (currencyCreated) await prisma.moneda.delete({ where: { codigo: 'CUP' } });
    await prisma.$disconnect();
  });
  it('guarda el saldo sin factura, compra, banco ni asiento individual', async () => {
    expect(await prisma.$transaction((tx) => persist(tx, input()))).toMatchObject({ count: 1, totalFuncional: '125.25' });
    const row = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId: tenantA } });
    expect(row).toMatchObject({ inicializacionId: initA, referenciaInicial: 'fila-1',
      tipo: 'inicial_externa', numeroFactura: null, fechaEmision: null,
      gastoCompraId: null, gastosDEId: null, monedaOriginal: 'CUP', monedaFuncional: 'CUP' });
    expect(row.montoDeuda.toString()).toBe('125.25');
    expect(row.montoDeudaFuncional?.toString()).toBe('125.25');
    expect(await prisma.compraDocumento.count({ where: { tenantId: tenantA } })).toBe(0);
    expect(await prisma.cuentaBancaria.count({ where: { tenantId: tenantA } })).toBe(0);
    expect(await prisma.asiento.count({ where: { tenantId: tenantA } })).toBe(0);
  });
  it('rechaza repetición de fila y proveedor de otro tenant', async () => {
    await expect(prisma.$transaction((tx) => persist(tx, input()))).rejects.toThrow();
    await expect(prisma.$transaction((tx) => persist(tx, { ...input(), cuentas: [
      { ...input().cuentas[0], referenciaFila: 'otra', proveedorId: vendorB },
    ] }))).rejects.toThrow('proveedores');
    expect(await prisma.cuentaPorPagar.count({ where: { tenantId: tenantA } })).toBe(1);
  });
  it('rechaza inicialización de otro tenant y origen incompleto', async () => {
    await expect(prisma.cuentaPorPagar.create({ data: {
      tenantId: tenantA, proveedorId: vendorA, inicializacionId: initB, referenciaInicial: 'foreign',
      tipo: 'inicial_externa', montoDeuda: '1', saldoPendiente: '1', fechaEmision: null,
    } })).rejects.toThrow();
    await expect(prisma.cuentaPorPagar.create({ data: {
      tenantId: tenantA, proveedorId: vendorA, tipo: 'inicial_externa',
      montoDeuda: '1', saldoPendiente: '1', fechaEmision: null,
    } })).rejects.toThrow();
  });
  it('protege el origen y revierte el conjunto si falla el coordinador', async () => {
    const row = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId: tenantA } });
    await expect(prisma.cuentaPorPagar.update({ where: { cuentaPorPagarId: row.cuentaPorPagarId },
      data: { referenciaInicial: 'cambiada' } })).rejects.toThrow('El origen de la cuenta inicial es inmutable');
    await expect(prisma.$transaction(async (tx) => {
      await persist(tx, { ...input(), cuentas: [{ ...input().cuentas[0], referenciaFila: 'rollback' }] });
      throw new Error('fallo de prueba');
    })).rejects.toThrow('fallo de prueba');
    expect(await prisma.cuentaPorPagar.count({ where: { tenantId: tenantA, referenciaInicial: 'rollback' } })).toBe(0);
  });
  it('valora una obligación en divisa con la tasa de la tabla y guarda la evidencia FX', async () => {
    const result = await prisma.$transaction((tx) => persist(tx, {
      ...input(), fechaCorte: '2026-11-01', tasas: { USD: '24' },
      cuentas: [{ referenciaFila: 'fx-1', proveedorId: vendorA, moneda: 'USD', saldo: '100' }],
    }));
    expect(result).toMatchObject({ count: 1, totalFuncional: '2400' });
    const row = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId: tenantA, referenciaInicial: 'fx-1' } });
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
  it('valora una obligación en divisa con la tasa de la fila', async () => {
    const result = await prisma.$transaction((tx) => persist(tx, {
      ...input(), fechaCorte: '2026-11-01',
      cuentas: [{ referenciaFila: 'fx-2', proveedorId: vendorA, moneda: 'USD', saldo: '100', tasaCambio: '25' }],
    }));
    expect(result).toMatchObject({ count: 1, totalFuncional: '2500' });
    const row = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId: tenantA, referenciaInicial: 'fx-2' } });
    expect(row.montoDeudaFuncional?.toString()).toBe('2500');
    expect(row.tasaCambio?.toString()).toBe('25');
  });
  it('rechaza divisa sin tasa declarada', async () => {
    await expect(prisma.$transaction((tx) => persist(tx, {
      ...input(), fechaCorte: '2026-11-01',
      cuentas: [{ referenciaFila: 'fx-sin-tasa', proveedorId: vendorA, moneda: 'USD', saldo: '100' }],
    }))).rejects.toThrow('divisa');
    expect(await prisma.cuentaPorPagar.count({ where: { tenantId: tenantA, referenciaInicial: 'fx-sin-tasa' } })).toBe(0);
  });
});
