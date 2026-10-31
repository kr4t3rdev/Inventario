import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectActionFailure } from '@/test/action-response';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { verifyAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const suffix = crypto.randomUUID().replaceAll('-', '');
const tenantName = `basic_partial_advance_${suffix}`;
const email = `${tenantName}@test.local`;
const fxCurrencyCode = `FX${suffix.slice(0, 6).toUpperCase()}`;

let prisma!: typeof import('@/lib/prisma').prisma;
let createCompraServicioAction!: typeof import('../actions').createCompraServicioAction;
let tenantId = '';
let userId = '';
let servicioId = '';
let cuentaId = '';
let tipoPagoId = '';
let anticipoId = '';
let rateId = '';

function basicUser(): AuthenticatedUser {
  return {
    userId,
    name: 'Basic integration actor',
    email,
    role: 'regularUser',
    isActive: true,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { servicios: true, 'cuentas-pagar': false },
    permissions: new Set(['compras.servicios.crear']),
  };
}

function proUser(): AuthenticatedUser {
  return {
    ...basicUser(),
    planFeatures: { servicios: true, 'cuentas-pagar': true },
  };
}

describe('Basic partial advance rollback — PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    process.env.PERIODO_GUARD_ENABLED = 'false';
    process.env.PERIODO_GUARD_MODE = 'disabled';
    const [prismaModule, actionModule] = await Promise.all([
      import('@/lib/prisma'),
      import('../actions'),
    ]);
    prisma = prismaModule.prisma;
    createCompraServicioAction = actionModule.createCompraServicioAction;

    const identity = await prisma.$queryRaw<Array<{
      databaseName: string; roleName: string; serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);

    const tenant = await prisma.tenant.create({ data: { nombre: tenantName, slug: tenantName } });
    tenantId = tenant.tenantId;
    const user = await prisma.user.create({
      data: { name: 'Basic integration actor', email, password: 'integration-only-placeholder' },
    });
    userId = user.userId;
    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      update: {},
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP', esPrincipal: true },
    });
    await prisma.moneda.create({
      data: { codigo: fxCurrencyCode, nombre: 'Integration FX', simbolo: fxCurrencyCode },
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    const rateEffectiveAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rate = await prisma.tasaCambio.create({
      data: {
        monedaOrigenId: fxCurrencyCode,
        monedaDestino: 'CUP',
        tasa: 24,
        fechaVigencia: rateEffectiveAt,
      },
    });
    rateId = rate.tasaId;
    const servicio = await prisma.servicios.create({
      data: {
        tenantId,
        nombre: 'Servicio de prueba',
        precio: 100,
        descripcion: 'Fixture',
        moneda: fxCurrencyCode,
      },
    });
    servicioId = servicio.servicioId;
    const cuenta = await prisma.cuentaBancaria.create({
      data: { tenantId, nombreBanco: 'Fixture bank', numeroCuenta: suffix, tipoCuenta: 'CORRIENTE' },
    });
    cuentaId = cuenta.cuentaId;
    const tipoPago = await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia' } });
    tipoPagoId = tipoPago.tipoId;
    const anticipo = await prisma.anticipo.create({
      data: {
        tenantId,
        tipo: 'PAGO',
        estado: 'RESERVADO',
        montoOriginal: 100,
        saldoDisponible: 100,
        moneda: fxCurrencyCode,
        cuentaOrigenId: cuentaId,
        tipoPagoOrigenId: tipoPagoId,
        createdById: userId,
      },
    });
    anticipoId = anticipo.anticipoId;
    vi.mocked(getCurrentUser).mockImplementation(async () => basicUser());
  });

  afterAll(async () => {
    if (!prisma) return;
    if (tenantId) {
      await prisma.transaccionMoneda.deleteMany({ where: { tenantId } });
      await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
      await prisma.anticipoMovimiento.deleteMany({ where: { anticipoId } });
      await prisma.compraServicio.deleteMany({ where: { tenantId } });
      await prisma.anticipo.deleteMany({ where: { tenantId } });
      await prisma.tipoPago.deleteMany({ where: { tenantId } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
      await prisma.servicios.deleteMany({ where: { tenantId } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { userId } });
    if (rateId) await prisma.tasaCambio.deleteMany({ where: { tasaId: rateId } });
    await prisma.moneda.deleteMany({ where: { codigo: fxCurrencyCode } });
    await prisma.$disconnect();
  });

  it('rolls back the service, reconciliation, and advance consumption when Basic cannot carry a balance', async () => {
    vi.mocked(getCurrentUser).mockImplementation(async () => basicUser());
    const beforeMovementCount = await prisma.anticipoMovimiento.count({ where: { anticipoId } });

    const result = await createCompraServicioAction({
      servicioId,
      costoUnitario: 200,
      cantidad: 1,
      formaPago: 'ANTICIPO_PAGO',
      estado: 'PAGADA',
      anticipos: [{ anticipoId, montoAplicado: 100 }],
    });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(await prisma.compraServicio.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.reconciliacionGasto.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.anticipoMovimiento.count({ where: { anticipoId } })).toBe(beforeMovementCount);
    const advance = await prisma.anticipo.findUniqueOrThrow({ where: { anticipoId } });
    expect(Number(advance.saldoDisponible)).toBe(100);
    expect(advance.estado).toBe('RESERVADO');
  });

  it('persists complete FX evidence for a successful USD advance reconciliation in PostgreSQL', async () => {
    vi.mocked(getCurrentUser).mockImplementation(async () => proUser());

    const result = await createCompraServicioAction({
      servicioId,
      costoUnitario: 100,
      cantidad: 1,
      formaPago: 'ANTICIPO_PAGO',
      estado: 'PAGADA',
      anticipos: [{ anticipoId, montoAplicado: 100 }],
    });

    expect(result.success).toBe(true);
    const purchase = await prisma.compraServicio.findFirstOrThrow({ where: { tenantId } });
    const reconciliation = await prisma.reconciliacionGasto.findFirstOrThrow({
      where: { tenantId, referenciaId: purchase.compraServicioId },
    });
    expect(reconciliation.moneda).toBe(fxCurrencyCode);
    expect(reconciliation.functionalCurrency).toBe('CUP');
    expect(Number(reconciliation.tasaCambio)).toBe(24);
    expect(Number(reconciliation.montoConvertido)).toBe(2400);
    expect(reconciliation.rateEffectiveAt).toBeInstanceOf(Date);
    expect(reconciliation.fxProvenanceKind).toBeTruthy();
    expect(reconciliation.fxProvenanceSource).toBe('accounting-reconciliation-service');
    expect(reconciliation.fxEvidenceVersion).toBe(1);
    expect(verifyAppliedFxEvidence({
      originalAmount: Number(reconciliation.monto),
      originalCurrency: reconciliation.moneda,
      functionalCurrency: reconciliation.functionalCurrency ?? '',
      convertedAmount: Number(reconciliation.montoConvertido),
      exchangeRate: Number(reconciliation.tasaCambio),
      rateEffectiveAt: reconciliation.rateEffectiveAt,
      fxProvenanceKind: reconciliation.fxProvenanceKind,
      fxProvenanceSource: reconciliation.fxProvenanceSource,
      fxCatalogRateId: reconciliation.fxCatalogRateId,
      fxEvidenceFingerprint: reconciliation.fxEvidenceFingerprint,
      fxEvidenceVersion: reconciliation.fxEvidenceVersion,
    })).toBe(true);
  });
});
