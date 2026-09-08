/**
 * @description Integración del scope de los modelos ola 3 de AS-05 (InyeccionCapital,
 * PagoDeuda, SaldoSnapshot). Con TENANT_ISOLATION_MODE=enforce: create inyecta el
 * tenant del contexto; lectura/escritura cruzada entre tenants no ve ni muta;
 * sin contexto falla cerrado.
 * Requiere: DATABASE_URL_TEST=... pnpm test:integration -- ola3-models
 * @module src/lib/db/__integration__/ola3-models-tenant.test
 */
process.env.TENANT_ISOLATION_MODE = 'enforce';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { prismaPlatform } from '@/lib/db/platform-prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import { TenantContextRequiredError } from '@/lib/db/scoped-prisma';

describe('AS-05 ola 3 InyeccionCapital tenant-scoped', { timeout: 30_000 }, () => {
  const suffix = Date.now();
  let tenantA = '';
  let tenantB = '';
  let cuentaA = '';
  let cuentaB = '';

  beforeAll(async () => {
    const a = await prismaPlatform.tenant.create({
      data: { nombre: `Capital A ${suffix}`, slug: `capital-a-${suffix}` },
    });
    const b = await prismaPlatform.tenant.create({
      data: { nombre: `Capital B ${suffix}`, slug: `capital-b-${suffix}` },
    });
    tenantA = a.tenantId;
    tenantB = b.tenantId;

    const ca = await prismaPlatform.cuentaBancaria.create({
      data: { nombreBanco: 'Banco A', numeroCuenta: `CA-${suffix}`, tipoCuenta: 'AHORRO', saldo: 1000, moneda: 'CUP', tenantId: tenantA, isActive: true },
    });
    const cb = await prismaPlatform.cuentaBancaria.create({
      data: { nombreBanco: 'Banco B', numeroCuenta: `CB-${suffix}`, tipoCuenta: 'AHORRO', saldo: 1000, moneda: 'CUP', tenantId: tenantB, isActive: true },
    });
    cuentaA = ca.cuentaId;
    cuentaB = cb.cuentaId;
  });

  afterAll(async () => {
    await prismaPlatform.inyeccionCapital.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.cuentaBancaria.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.tenant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  });

  it('create inyecta el tenant desde el contexto', async () => {
    const row = await withTestTenant(tenantA, async () =>
      await prisma.inyeccionCapital.create({
        data: { tipo: 'CAPITAL_SOCIAL', montoRecibido: 500, moneda: 'CUP', cuentaId: cuentaA, tenantId: tenantA },
      }),
    );
    expect(row.tenantId).toBe(tenantA);
  });

  it('lectura cruzada no ve filas del otro tenant', async () => {
    const created = await withTestTenant(tenantB, async () =>
      await prisma.inyeccionCapital.create({
        data: { tipo: 'CAPITAL_SOCIAL', montoRecibido: 300, moneda: 'CUP', cuentaId: cuentaB, tenantId: tenantB },
      }),
    );
    const cross = await withTestTenant(tenantA, async () =>
      await prisma.inyeccionCapital.findUnique({ where: { id: created.id } }),
    );
    expect(cross).toBeNull();
  });

  it('update/delete cruzados no afectan (P2025)', async () => {
    const created = await withTestTenant(tenantB, async () =>
      await prisma.inyeccionCapital.create({
        data: { tipo: 'CAPITAL_SOCIAL', montoRecibido: 200, moneda: 'CUP', cuentaId: cuentaB, tenantId: tenantB },
      }),
    );
    const updateErr = await withTestTenant(tenantA, async () =>
      await prisma.inyeccionCapital.update({ where: { id: created.id }, data: { montoRecibido: 999 } }).catch((e: unknown) => e),
    );
    expect((updateErr as { code?: string })?.code).toBe('P2025');

    const deleteErr = await withTestTenant(tenantA, async () =>
      await prisma.inyeccionCapital.delete({ where: { id: created.id } }).catch((e: unknown) => e),
    );
    expect((deleteErr as { code?: string })?.code).toBe('P2025');
  });

  it('sin contexto en enforce falla cerrado', async () => {
    let error: unknown;
    try {
      await prisma.inyeccionCapital.findMany();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantContextRequiredError);
  });
});

describe('AS-05 ola 3 PagoDeuda tenant-scoped', { timeout: 30_000 }, () => {
  const suffix = Date.now();
  let tenantA = '';
  let tenantB = '';
  let inyeccionA = '';
  let inyeccionB = '';
  let cuentaA = '';
  let cuentaB = '';

  beforeAll(async () => {
    const a = await prismaPlatform.tenant.create({
      data: { nombre: `Pago A ${suffix}`, slug: `pago-a-${suffix}` },
    });
    const b = await prismaPlatform.tenant.create({
      data: { nombre: `Pago B ${suffix}`, slug: `pago-b-${suffix}` },
    });
    tenantA = a.tenantId;
    tenantB = b.tenantId;

    const ca = await prismaPlatform.cuentaBancaria.create({
      data: { nombreBanco: 'Banco A', numeroCuenta: `PA-${suffix}`, tipoCuenta: 'AHORRO', saldo: 5000, moneda: 'CUP', tenantId: tenantA, isActive: true },
    });
    const cb = await prismaPlatform.cuentaBancaria.create({
      data: { nombreBanco: 'Banco B', numeroCuenta: `PB-${suffix}`, tipoCuenta: 'AHORRO', saldo: 5000, moneda: 'CUP', tenantId: tenantB, isActive: true },
    });
    cuentaA = ca.cuentaId;
    cuentaB = cb.cuentaId;

    const ia = await prismaPlatform.inyeccionCapital.create({
      data: { tipo: 'DEUDA_EXTERNA', montoRecibido: 2000, moneda: 'CUP', cuentaId: cuentaA, estado: 'ACTIVA', saldoPendiente: 2000, tenantId: tenantA },
    });
    const ib = await prismaPlatform.inyeccionCapital.create({
      data: { tipo: 'DEUDA_EXTERNA', montoRecibido: 2000, moneda: 'CUP', cuentaId: cuentaB, estado: 'ACTIVA', saldoPendiente: 2000, tenantId: tenantB },
    });
    inyeccionA = ia.id;
    inyeccionB = ib.id;
  });

  afterAll(async () => {
    await prismaPlatform.pagoDeuda.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.inyeccionCapital.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.cuentaBancaria.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.tenant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  });

  it('create inyecta el tenant desde el contexto', async () => {
    const row = await withTestTenant(tenantA, async () =>
      await prisma.pagoDeuda.create({
        data: { inyeccionId: inyeccionA, montoPagado: 500, cuentaId: cuentaA, numeroCuota: 1, tenantId: tenantA },
      }),
    );
    expect(row.tenantId).toBe(tenantA);
  });

  it('lectura cruzada no ve filas del otro tenant', async () => {
    const created = await withTestTenant(tenantB, async () =>
      await prisma.pagoDeuda.create({
        data: { inyeccionId: inyeccionB, montoPagado: 300, cuentaId: cuentaB, numeroCuota: 1, tenantId: tenantB },
      }),
    );
    const cross = await withTestTenant(tenantA, async () =>
      await prisma.pagoDeuda.findUnique({ where: { id: created.id } }),
    );
    expect(cross).toBeNull();
  });

  it('update/delete cruzados no afectan (P2025)', async () => {
    const created = await withTestTenant(tenantB, async () =>
      await prisma.pagoDeuda.create({
        data: { inyeccionId: inyeccionB, montoPagado: 200, cuentaId: cuentaB, numeroCuota: 2, tenantId: tenantB },
      }),
    );
    const updateErr = await withTestTenant(tenantA, async () =>
      await prisma.pagoDeuda.update({ where: { id: created.id }, data: { montoPagado: 999 } }).catch((e: unknown) => e),
    );
    expect((updateErr as { code?: string })?.code).toBe('P2025');

    const deleteErr = await withTestTenant(tenantA, async () =>
      await prisma.pagoDeuda.delete({ where: { id: created.id } }).catch((e: unknown) => e),
    );
    expect((deleteErr as { code?: string })?.code).toBe('P2025');
  });

  it('sin contexto en enforce falla cerrado', async () => {
    let error: unknown;
    try {
      await prisma.pagoDeuda.findMany();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantContextRequiredError);
  });
});

describe('AS-05 ola 3 SaldoSnapshot tenant-scoped', { timeout: 30_000 }, () => {
  const suffix = Date.now();
  let tenantA = '';
  let tenantB = '';
  let periodoA = '';
  let periodoB = '';
  let cuentaA = '';
  let cuentaB = '';

  beforeAll(async () => {
    const a = await prismaPlatform.tenant.create({
      data: { nombre: `Saldo A ${suffix}`, slug: `saldo-a-${suffix}` },
    });
    const b = await prismaPlatform.tenant.create({
      data: { nombre: `Saldo B ${suffix}`, slug: `saldo-b-${suffix}` },
    });
    tenantA = a.tenantId;
    tenantB = b.tenantId;

    const pa = await prismaPlatform.periodoContable.create({
      data: { tipo: 'MENSUAL', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-01-31'), tenantId: tenantA },
    });
    const pb = await prismaPlatform.periodoContable.create({
      data: { tipo: 'MENSUAL', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-01-31'), tenantId: tenantB },
    });
    periodoA = pa.periodoId;
    periodoB = pb.periodoId;

    const ca = await prismaPlatform.cuentaBancaria.create({
      data: { nombreBanco: 'Banco A', numeroCuenta: `SA-${suffix}`, tipoCuenta: 'AHORRO', saldo: 1000, moneda: 'CUP', tenantId: tenantA, isActive: true },
    });
    const cb = await prismaPlatform.cuentaBancaria.create({
      data: { nombreBanco: 'Banco B', numeroCuenta: `SB-${suffix}`, tipoCuenta: 'AHORRO', saldo: 1000, moneda: 'CUP', tenantId: tenantB, isActive: true },
    });
    cuentaA = ca.cuentaId;
    cuentaB = cb.cuentaId;
  });

  afterAll(async () => {
    await prismaPlatform.saldoSnapshot.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.cuentaBancaria.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.periodoContable.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.tenant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  });

  it('create inyecta el tenant desde el contexto', async () => {
    const row = await withTestTenant(tenantA, async () =>
      await prisma.saldoSnapshot.create({
        data: { periodoId: periodoA, cuentaBancariaId: cuentaA, saldo: 100, moneda: 'CUP', tenantId: tenantA },
      }),
    );
    expect(row.tenantId).toBe(tenantA);
  });

  it('lectura cruzada no ve filas del otro tenant', async () => {
    const created = await withTestTenant(tenantB, async () =>
      await prisma.saldoSnapshot.create({
        data: { periodoId: periodoB, cuentaBancariaId: cuentaB, saldo: 200, moneda: 'CUP', tenantId: tenantB },
      }),
    );
    const cross = await withTestTenant(tenantA, async () =>
      await prisma.saldoSnapshot.findUnique({ where: { snapshotId: created.snapshotId } }),
    );
    expect(cross).toBeNull();
  });

  it('update/delete cruzados no afectan (P2025)', async () => {
    const created = await withTestTenant(tenantB, async () =>
      await prisma.saldoSnapshot.create({
        data: { periodoId: periodoB, cuentaBancariaId: cuentaB, saldo: 300, moneda: 'CUP', tenantId: tenantB },
      }),
    );
    const updateErr = await withTestTenant(tenantA, async () =>
      await prisma.saldoSnapshot.update({ where: { snapshotId: created.snapshotId }, data: { saldo: 999 } }).catch((e: unknown) => e),
    );
    expect((updateErr as { code?: string })?.code).toBe('P2025');

    const deleteErr = await withTestTenant(tenantA, async () =>
      await prisma.saldoSnapshot.delete({ where: { snapshotId: created.snapshotId } }).catch((e: unknown) => e),
    );
    expect((deleteErr as { code?: string })?.code).toBe('P2025');
  });

  it('sin contexto en enforce falla cerrado', async () => {
    let error: unknown;
    try {
      await prisma.saldoSnapshot.findMany();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantContextRequiredError);
  });
});
