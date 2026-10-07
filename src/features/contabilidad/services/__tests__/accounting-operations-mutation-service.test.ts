import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

const create = vi.fn();
const update = vi.fn();
const accountUpdateMany = vi.fn();
const findUnique = vi.fn();
const adjustmentFindUnique = vi.fn();
const capitalFindUnique = vi.fn();
const findFirst = vi.fn();
const transaction = vi.fn();
const acquireAccountingTenantLock = vi.fn();
const capitalCreate = vi.fn();
const inyeccionFindFirst = vi.fn();
const inyeccionUpdate = vi.fn();
const pagoCreate = vi.fn();
const auditLogCreate = vi.fn();
const postEventoMock = vi.fn();
const tenantAccountingPolicyFindUnique = vi.fn();
const transferFindFirst = vi.fn();
const transferCreate = vi.fn();
const tasaCambioFindFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findUnique, findFirst },
    ajusteBancario: { findUnique: adjustmentFindUnique },
    inyeccionCapital: { findUnique: capitalFindUnique },
    transferenciaBancaria: { findFirst: transferFindFirst },
    $transaction: transaction,
  },
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: auditLogCreate },
}));

vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: postEventoMock,
}));

vi.mock('../accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock,
}));

import { requireFeature, requirePermission } from '@/lib/services/tenant-scope';

describe('AccountingOperationsMutationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adjustmentFindUnique.mockResolvedValue(null);
    capitalFindUnique.mockResolvedValue(null);
    findUnique.mockResolvedValue({
      cuentaId: 'account-1',
      tenantId: 'tenant-1',
      isActive: true,
      saldo: 1000,
      nombreBanco: 'Banco',
    });
    findFirst.mockResolvedValue({
      cuentaId: 'account-1',
      tenantId: 'tenant-1',
      isActive: true,
      saldo: 1000,
      moneda: 'CUP',
      nombreBanco: 'Banco',
    });
    create.mockResolvedValue({ ajusteId: 'adjustment-1' });
    update.mockResolvedValue({ count: 1 });
    accountUpdateMany.mockResolvedValue({ count: 1 });
    capitalCreate.mockResolvedValue({
      id: 'capital-1',
      tipo: 'CAPITAL_SOCIAL',
      montoRecibido: 250,
      moneda: 'CUP',
      cuentaId: 'account-1',
    });
    auditLogCreate.mockResolvedValue({ id: 'audit-1' });
    inyeccionFindFirst.mockResolvedValue({
      id: 'inyeccion-1',
      tipo: 'DEUDA_EXTERNA',
      saldoPendiente: 1100,
      cuentaId: 'account-1',
      pagos: [],
    });
    inyeccionUpdate.mockResolvedValue({ id: 'inyeccion-1' });
    pagoCreate.mockResolvedValue({ id: 'pago-1' });
    tenantAccountingPolicyFindUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
    transferFindFirst.mockResolvedValue(null);
    transferCreate.mockImplementation(async ({ data }) => ({ transferenciaId: 'trf-1', ...data }));
    transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      ajusteBancario: { create, findUnique: adjustmentFindUnique },
      cuentaBancaria: { findFirst, update, updateMany: accountUpdateMany },
      transferenciaBancaria: { create: transferCreate },
      inyeccionCapital: {
        create: capitalCreate,
        findUnique: capitalFindUnique,
        findFirst: inyeccionFindFirst,
        update: inyeccionUpdate,
      },
      pagoDeuda: { create: pagoCreate },
      auditLog: { create: auditLogCreate },
      tenantAccountingPolicy: { findUnique: tenantAccountingPolicyFindUnique },
      tasaCambio: { findFirst: tasaCambioFindFirst },
    }));
    tasaCambioFindFirst.mockResolvedValue(null);
  });

  it('persiste la fecha de operación elegida para el ajuste', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const fechaOperacion = new Date('2026-01-15T12:00:00.000Z');

    await AccountingOperationsMutationService.createBankAdjustment({
      input: {
        cuentaId: 'account-1',
        tipo: 'egreso',
        monto: 100,
        moneda: 'CUP',
        descripcion: 'Corrección bancaria',
        motivo: 'Diferencia conciliada',
        fechaOperacion,
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        montoConvertido: new Prisma.Decimal(100),
        tasaCambio: new Prisma.Decimal(1),
        fechaOperacion,
      }),
    });
  });

  it('scopea la cuenta de un ajuste bancario y exige feature/permisos', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');

    await AccountingOperationsMutationService.createBankAdjustment({
      input: {
        cuentaId: 'account-1', tipo: 'ingreso', monto: 40, moneda: 'CUP',
        descripcion: 'Ajuste', motivo: 'Corrección',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true },
    }));
    expect(accountUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true },
    }));
    expect(requireFeature).toHaveBeenCalledWith(expect.anything(), 'contabilidad', expect.any(String));
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'financiero.contabilidad.acceder', expect.any(String),
    );
  });

  it('persiste FX del ajuste y transmite la evidencia de la fila al asiento', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const fechaOperacion = new Date('2026-09-25T12:00:00.000Z');
    findFirst.mockResolvedValueOnce({
      cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true,
      saldo: 1000, moneda: 'USD', tipoCuenta: 'BANCO',
    });
    create.mockImplementationOnce(async ({ data }) => ({ ajusteId: 'adjustment-fx', ...data }));

    await AccountingOperationsMutationService.createBankAdjustment({
      input: {
        cuentaId: 'account-1', tipo: 'ingreso', monto: 100, moneda: 'USD', tasaCambio: 24,
        descripcion: 'Ajuste FX', motivo: 'Prueba', fechaOperacion,
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        montoConvertido: new Prisma.Decimal(2400),
        tasaCambio: new Prisma.Decimal(24),
        fxEvidenceFingerprint: expect.any(String),
        rateEffectiveAt: fechaOperacion,
      }),
    }));
    expect(postEventoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1' }),
      expect.objectContaining({
        tipo: 'AJUSTE_BANCARIO_ABONO',
        montoFuncional: new Prisma.Decimal(2400),
        tasaCambio: new Prisma.Decimal(24),
        fxEvidenceFingerprint: expect.any(String),
      }),
    );
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'CREATE', entidad: 'AJUSTE_BANCARIO', entidadId: 'adjustment-fx',
    }), expect.anything());
  });

  it('rechaza ajuste extranjero sin evidencia FX dentro de la transacción sin mutar', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst.mockResolvedValueOnce({
      cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true,
      saldo: 1000, moneda: 'USD', tipoCuenta: 'BANCO',
    });

    await expect(AccountingOperationsMutationService.createBankAdjustment({
      input: {
        cuentaId: 'account-1', tipo: 'ingreso', monto: 40, moneda: 'USD',
        descripcion: 'Ajuste FX incompleto', motivo: 'Prueba',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    // La política y la conversión se leen dentro del tx: se abre pero no muta.
    expect(transaction).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(accountUpdateMany).not.toHaveBeenCalled();
  });

  it('valora el ajuste con la moneda funcional del tenant (no CUP por defecto)', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst.mockResolvedValueOnce({
      cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true,
      saldo: 1000, moneda: 'USD', tipoCuenta: 'BANCO',
    });
    tenantAccountingPolicyFindUnique.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });

    await AccountingOperationsMutationService.createBankAdjustment({
      input: {
        cuentaId: 'account-1', tipo: 'ingreso', monto: 100, moneda: 'USD',
        descripcion: 'Ajuste USD', motivo: 'Prueba',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        montoConvertido: new Prisma.Decimal(100),
        tasaCambio: new Prisma.Decimal(1),
        functionalCurrency: 'USD',
      }),
    });
  });

  it('valora la inyección con la moneda funcional del tenant (no CUP por defecto)', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst.mockResolvedValueOnce({
      cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true,
      saldo: 1000, moneda: 'USD', tipoCuenta: 'BANCO',
    });
    tenantAccountingPolicyFindUnique.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });
    capitalCreate.mockImplementationOnce(async ({ data }) => ({ id: 'capital-usd', ...data }));

    await AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 500, moneda: 'USD', tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1', socio: 'Socio',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(capitalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        montoConvertido: new Prisma.Decimal(500),
        tasaCambio: new Prisma.Decimal(1),
        functionalCurrency: 'USD',
      }),
    });
  });

  it('pasa dos mutaciones del mismo tenant por el lock contable común', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const input = {
      cuentaId: 'account-1',
      tipo: 'ingreso' as const,
      monto: 25,
      moneda: 'CUP',
      descripcion: 'Ingreso',
      motivo: 'Prueba de concurrencia',
    };

    await Promise.all([
      AccountingOperationsMutationService.createBankAdjustment({
        input,
        user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
      }),
      AccountingOperationsMutationService.createBankAdjustment({
        input: { ...input, descripcion: 'Segundo ingreso' },
        user: { userId: 'user-2', tenantId: 'tenant-1' } as never,
      }),
    ]);

    expect(acquireAccountingTenantLock).toHaveBeenCalledTimes(2);
    expect(acquireAccountingTenantLock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'tenant-1',
    );
    expect(acquireAccountingTenantLock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'tenant-1',
    );
  });

  it('crea una inyección con los campos Prisma y aumenta el saldo una sola vez', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');

    await AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 250,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1',
        socio: 'Socio fundador',
        descripcion: 'Aporte inicial adicional',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { cuentaId: 'account-1', tenantId: 'tenant-1' },
      select: expect.objectContaining({
        cuentaId: true,
        saldo: true,
        moneda: true,
        isActive: true,
      }),
    });
    expect(capitalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'CAPITAL_SOCIAL',
        montoRecibido: new Prisma.Decimal(250),
        moneda: 'CUP',
        cuentaId: 'account-1',
        socio: 'Socio fundador',
        entidadPrestamista: null,
      }),
    });
    expect(capitalCreate.mock.calls[0][0].data).not.toHaveProperty('monto');
    expect(capitalCreate.mock.calls[0][0].data).not.toHaveProperty('cuentaBancariaId');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { cuentaId: 'account-1' },
      data: { saldo: { increment: 250 } },
    });
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ entidad: 'INYECCION_CAPITAL' }),
      expect.objectContaining({ inyeccionCapital: expect.objectContaining({ create: capitalCreate }) }),
    );
  });

  it('persiste los datos específicos de una deuda externa', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');

    await AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 1000,
        moneda: 'CUP',
        tipo: 'DEUDA_EXTERNA',
        cuentaId: 'account-1',
        entidadPrestamista: 'Financiera externa',
        tasaInteres: 10,
        plazoMeses: 12,
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(capitalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'DEUDA_EXTERNA',
        montoRecibido: new Prisma.Decimal(1000),
        tasaInteres: 10,
        montoInteres: new Prisma.Decimal(100),
        montoTotalDeuda: new Prisma.Decimal(1100),
        saldoPendiente: new Prisma.Decimal(1100),
        plazoMeses: 12,
        entidadPrestamista: 'Financiera externa',
        socio: null,
        estado: 'ACTIVA',
      }),
    });
  });

  it('rechaza una cuenta inexistente o de otro tenant sin abrir escrituras', async () => {
    findFirst.mockResolvedValueOnce(null);
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');

    await expect(AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 250,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'foreign-account',
        socio: 'Socio fundador',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(capitalCreate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta inactiva o con moneda distinta', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');

    findFirst.mockResolvedValueOnce({
      cuentaId: 'account-1',
      tenantId: 'tenant-1',
      isActive: false,
      saldo: 1000,
      moneda: 'CUP',
    });
    await expect(AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 250,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1',
        socio: 'Socio fundador',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    findFirst.mockResolvedValueOnce({
      cuentaId: 'account-1',
      tenantId: 'tenant-1',
      isActive: true,
      saldo: 1000,
      moneda: 'USD',
    });
    await expect(AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 250,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1',
        socio: 'Socio fundador',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(capitalCreate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('mantiene inyección, saldo y auditoría dentro de la transacción', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    auditLogCreate.mockRejectedValueOnce(new Error('audit failed'));

    await expect(AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 250,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1',
        socio: 'Socio fundador',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toThrow('audit failed');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalled();
  });

  it('deniega inyección de capital sin permiso antes de abrir transacción', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    vi.mocked(requirePermission).mockImplementationOnce(() => { throw new Error('FORBIDDEN'); });

    await expect(AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 250, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL', cuentaId: 'account-1',
        socio: 'Socio fundador',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toThrow('FORBIDDEN');

    expect(transaction).not.toHaveBeenCalled();
  });

  it('rechaza una clave de capital reutilizada con interés distinto', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    capitalFindUnique.mockResolvedValueOnce({
      id: 'capital-existing', montoRecibido: new Prisma.Decimal('100.00'), moneda: 'CUP',
      tipo: 'DEUDA_EXTERNA', cuentaId: 'account-1', descripcion: 'Préstamo', socio: null,
      entidadPrestamista: 'Entidad', tasaInteres: new Prisma.Decimal('5'), tasaCambio: new Prisma.Decimal('1'),
      plazoMeses: 12, fechaInicioPago: null, fechaRegistro: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 100, moneda: 'CUP', tipo: 'DEUDA_EXTERNA', cuentaId: 'account-1',
        entidadPrestamista: 'Entidad', tasaInteres: 6, plazoMeses: 12, idempotencyKey: 'capital-key',
        descripcion: 'Préstamo',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    // La detección se hace dentro de la transacción, bajo el lock del tenant.
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('rechaza un ajuste con la misma clave y fecha de operación distinta', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    adjustmentFindUnique.mockResolvedValueOnce({
      ajusteId: 'adjustment-existing', tipo: 'ingreso', monto: new Prisma.Decimal('10'), moneda: 'CUP',
      cuentaId: 'account-1', tasaCambio: new Prisma.Decimal('1'), descripcion: 'Ajuste', motivo: 'Corrección',
      fechaOperacion: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(AccountingOperationsMutationService.createBankAdjustment({
      input: {
        cuentaId: 'account-1', tipo: 'ingreso', monto: 10, moneda: 'CUP', descripcion: 'Ajuste',
        motivo: 'Corrección', fechaOperacion: new Date('2026-01-02T00:00:00.000Z'), idempotencyKey: 'adjust-key',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    // La detección se hace dentro de la transacción, bajo el lock del tenant.
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('deniega pago de deuda de capital sin permiso antes de abrir transacción', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    vi.mocked(requirePermission).mockImplementationOnce(() => { throw new Error('FORBIDDEN'); });

    await expect(AccountingOperationsMutationService.registerCapitalPayment({
      input: {
        inyeccionId: 'inyeccion-1', monto: 100, cuentaBancariaId: 'account-1', tipoPagoId: 'tipo-1',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toThrow('FORBIDDEN');

    expect(transaction).not.toHaveBeenCalled();
  });

  it('persiste la fecha de operación que fue validada por el período', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const fechaOperacion = '2026-01-15T12:00:00.000Z';

    await AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 250,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1',
        socio: 'Socio fundador',
        fechaOperacion,
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(capitalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fechaRegistro: new Date(fechaOperacion),
      }),
    });
  });

  it('registra un pago de deuda con campos reales y descuenta saldo y pendiente', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');

    const result = await AccountingOperationsMutationService.registerCapitalPayment({
      input: {
        inyeccionId: 'inyeccion-1',
        monto: 300,
        cuentaBancariaId: 'account-1',
        tipoPagoId: 'tipo-1',
        observaciones: 'Primera cuota',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(result).toEqual({ id: 'pago-1' });
    // La inyección se escopa por la cuenta bancaria referenciada (no tiene tenantId propio).
    expect(inyeccionFindFirst).toHaveBeenCalledWith({
      where: { id: 'inyeccion-1', cuentaBancaria: { tenantId: 'tenant-1' } },
      select: { id: true, tipo: true, moneda: true, saldoPendiente: true, pagos: { select: { id: true } } },
    });
    // Escribe solo columnas reales del modelo PagoDeuda.
    const pagoData = pagoCreate.mock.calls[0][0].data as Record<string, unknown>;
    expect(pagoData).toMatchObject({
      tenantId: 'tenant-1',
      inyeccionId: 'inyeccion-1',
      montoPagado: new Prisma.Decimal(300),
      cuentaId: 'account-1',
      numeroCuota: 1,
      observaciones: 'Primera cuota',
    });
    expect(pagoData).not.toHaveProperty('monto');
    expect(pagoData).not.toHaveProperty('cuentaBancariaId');
    expect(pagoData).not.toHaveProperty('tipoPagoId');
    // Descuenta saldo de cuenta y saldo pendiente de la deuda.
    expect(accountUpdateMany).toHaveBeenCalledWith({
      where: { cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true },
      data: { saldo: { decrement: 300 } },
    });
    expect(inyeccionUpdate).toHaveBeenCalledWith({
      where: { id: 'inyeccion-1' },
      data: expect.objectContaining({ saldoPendiente: { decrement: new Prisma.Decimal(300) } }),
    });
  });

  it('rechaza un pago sobre una inyección de otro tenant sin abrir escrituras', async () => {
    inyeccionFindFirst.mockResolvedValueOnce(null);
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');

    await expect(AccountingOperationsMutationService.registerCapitalPayment({
      input: {
        inyeccionId: 'foreign-1',
        monto: 100,
        cuentaBancariaId: 'account-1',
        tipoPagoId: 'tipo-1',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(pagoCreate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(inyeccionUpdate).not.toHaveBeenCalled();
  });

  it('persiste FX de inyección extranjera y la hereda al asiento', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const fechaOperacion = new Date('2026-09-25T12:00:00.000Z');
    findFirst.mockResolvedValueOnce({
      cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true,
      saldo: 1000, moneda: 'USD', tipoCuenta: 'BANCO',
    });
    capitalCreate.mockImplementationOnce(async ({ data }) => ({ id: 'capital-fx', ...data }));

    await AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 100, moneda: 'USD', tasaCambio: 24, tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1', socio: 'Socio', fechaOperacion,
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(capitalCreate.mock.calls[0][0].data).toMatchObject({
      montoConvertido: new Prisma.Decimal(2400),
      tasaCambio: new Prisma.Decimal(24),
      fxEvidenceFingerprint: expect.any(String),
      rateEffectiveAt: fechaOperacion,
    });
    expect(postEventoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1' }),
      expect.objectContaining({
        tipo: 'INYECCION_CAPITAL', montoFuncional: new Prisma.Decimal(2400), tasaCambio: new Prisma.Decimal(24),
        fxEvidenceFingerprint: expect.any(String), fecha: fechaOperacion,
      }),
    );
  });

  it('persiste FX del pago de deuda de capital y la hereda al asiento', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const fechaOperacion = new Date('2026-09-25T12:00:00.000Z');
    findFirst.mockResolvedValueOnce({
      cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true,
      saldo: 1000, moneda: 'USD', tipoCuenta: 'BANCO',
    });
    inyeccionFindFirst.mockResolvedValueOnce({
      id: 'inyeccion-1', tipo: 'DEUDA_EXTERNA', saldoPendiente: 1100,
      cuentaId: 'account-1', moneda: 'USD', pagos: [],
    });
    pagoCreate.mockImplementationOnce(async ({ data }) => ({ id: 'payment-fx', ...data }));

    await AccountingOperationsMutationService.registerCapitalPayment({
      input: {
        inyeccionId: 'inyeccion-1', monto: 25, cuentaBancariaId: 'account-1',
        tipoPagoId: 'tipo-1', moneda: 'USD', tasaCambio: 24, fechaOperacion,
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(pagoCreate.mock.calls[0][0].data).toMatchObject({
      montoConvertido: new Prisma.Decimal(600),
      moneda: 'USD',
      tasaCambio: new Prisma.Decimal(24),
      fxEvidenceFingerprint: expect.any(String),
      rateEffectiveAt: fechaOperacion,
    });
    expect(postEventoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1' }),
      expect.objectContaining({
        tipo: 'PAGO_DEUDA_CAPITAL', montoFuncional: new Prisma.Decimal(600), tasaCambio: new Prisma.Decimal(24),
        fxEvidenceFingerprint: expect.any(String), fecha: fechaOperacion,
      }),
    );
  });

  it('transfiere USD→USD con política USD sin exigir tasa y con evidencia funcional', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst
      .mockResolvedValueOnce({
        cuentaId: 'origen', tenantId: 'tenant-1', isActive: true,
        saldo: 1000, moneda: 'USD', nombreBanco: 'B1',
      })
      .mockResolvedValueOnce({
        cuentaId: 'destino', tenantId: 'tenant-1', isActive: true,
        saldo: 500, moneda: 'USD', nombreBanco: 'B2',
      });
    tenantAccountingPolicyFindUnique.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });

    await AccountingOperationsMutationService.createBankTransfer({
      input: {
        cuentaOrigenId: 'origen', cuentaDestinoId: 'destino',
        montoOrigen: 100, motivo: 'Prueba USD',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(transferCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        montoOrigen: new Prisma.Decimal(100), monedaOrigen: 'USD',
        montoDestino: new Prisma.Decimal(100), monedaDestino: 'USD',
        montoConvertido: new Prisma.Decimal(100), tasaCambio: new Prisma.Decimal(1),
        functionalCurrency: 'USD',
        fxEvidenceVersion: 2,
        fxEvidenceJson: expect.objectContaining({
          fxEvidenceVersion: 2,
          functionalCurrency: 'USD',
          originalCurrency: 'USD',
        }),
        numeroComprobante: 'TRF-000001',
      }),
    }));
  });

  it('convierte transferencia funcional→extranjera con la tasa de la pata extranjera', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst
      .mockResolvedValueOnce({
        cuentaId: 'origen', tenantId: 'tenant-1', isActive: true,
        saldo: 1000, moneda: 'USD', nombreBanco: 'B1',
      })
      .mockResolvedValueOnce({
        cuentaId: 'destino', tenantId: 'tenant-1', isActive: true,
        saldo: 500, moneda: 'EUR', nombreBanco: 'B2',
      });
    tenantAccountingPolicyFindUnique.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });

    await AccountingOperationsMutationService.createBankTransfer({
      input: {
        cuentaOrigenId: 'origen', cuentaDestinoId: 'destino',
        montoOrigen: 110, motivo: 'Prueba USD→EUR', tasaCambio: 1.1,
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    const data = transferCreate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      monedaOrigen: 'USD', monedaDestino: 'EUR',
      montoConvertido: new Prisma.Decimal(110), functionalCurrency: 'USD',
    });
    expect((data.montoDestino as Prisma.Decimal).toNumber()).toBeCloseTo(100, 4);
  });

  it('rechaza transferencia entre dos extranjeras sin cotización cruzada', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst
      .mockResolvedValueOnce({
        cuentaId: 'origen', tenantId: 'tenant-1', isActive: true,
        saldo: 1000, moneda: 'EUR', nombreBanco: 'B1',
      })
      .mockResolvedValueOnce({
        cuentaId: 'destino', tenantId: 'tenant-1', isActive: true,
        saldo: 500, moneda: 'GBP', nombreBanco: 'B2',
      });
    tenantAccountingPolicyFindUnique.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });

    await expect(AccountingOperationsMutationService.createBankTransfer({
      input: {
        cuentaOrigenId: 'origen', cuentaDestinoId: 'destino',
        montoOrigen: 100, motivo: 'Cruce sin quote',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    expect(transferCreate).not.toHaveBeenCalled();
  });

  it('rechaza tasa manual en par cruzado: la cotización sale del catálogo', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst
      .mockResolvedValueOnce({
        cuentaId: 'origen', tenantId: 'tenant-1', isActive: true,
        saldo: 1000, moneda: 'EUR', nombreBanco: 'B1',
      })
      .mockResolvedValueOnce({
        cuentaId: 'destino', tenantId: 'tenant-1', isActive: true,
        saldo: 500, moneda: 'GBP', nombreBanco: 'B2',
      });
    tenantAccountingPolicyFindUnique.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });

    await expect(AccountingOperationsMutationService.createBankTransfer({
      input: {
        cuentaOrigenId: 'origen', cuentaDestinoId: 'destino',
        montoOrigen: 100, motivo: 'Cruce con tasa manual', tasaCambio: 1.2,
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    expect(transferCreate).not.toHaveBeenCalled();
  });

  it('resuelve par cruzado por triangulación del catálogo con evidencia CATALOG_RATE', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst
      .mockResolvedValueOnce({
        cuentaId: 'origen', tenantId: 'tenant-1', isActive: true,
        saldo: 1000, moneda: 'EUR', nombreBanco: 'B1',
      })
      .mockResolvedValueOnce({
        cuentaId: 'destino', tenantId: 'tenant-1', isActive: true,
        saldo: 500, moneda: 'GBP', nombreBanco: 'B2',
      });
    tenantAccountingPolicyFindUnique.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });
    const vigencia = new Date('2026-01-01T00:00:00.000Z');
    tasaCambioFindFirst.mockImplementation(async ({ where }: any) => {
      const key = `${where.monedaOrigenId}→${where.monedaDestino}`;
      if (key === 'EUR→USD') return { tasaId: 't-eur-usd', tasa: new Prisma.Decimal('1.1'), fechaVigencia: vigencia };
      if (key === 'GBP→USD') return { tasaId: 't-gbp-usd', tasa: new Prisma.Decimal('1.25'), fechaVigencia: vigencia };
      return null;
    });

    await AccountingOperationsMutationService.createBankTransfer({
      input: {
        cuentaOrigenId: 'origen', cuentaDestinoId: 'destino',
        montoOrigen: 100, motivo: 'Cruce triangulado',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    const data = transferCreate.mock.calls[0][0].data as Record<string, unknown>;
    // 100 EUR × (1.1/1.25) = 88 GBP; funcional 100 × 1.1 = 110 USD.
    expect((data.montoDestino as Prisma.Decimal).toNumber()).toBeCloseTo(88, 4);
    expect((data.tasaCambio as Prisma.Decimal).toString()).toBe('0.88');
    expect((data.montoConvertido as Prisma.Decimal).toString()).toBe('110');
    expect(data).toMatchObject({
      monedaOrigen: 'EUR', monedaDestino: 'GBP',
      functionalCurrency: 'USD',
      fxProvenanceKind: 'CATALOG_RATE',
      fxCatalogRateId: 't-eur-usd',
      fxEvidenceVersion: 2,
    });
    const json = data.fxEvidenceJson as Record<string, any>;
    expect(json.fxProvenanceKind).toBe('CATALOG_RATE');
    expect(json.crossQuote).toMatchObject({
      fromCurrency: 'EUR', toCurrency: 'GBP', kind: 'TRIANGULATED',
      catalogRateIds: ['t-eur-usd', 't-gbp-usd'],
    });
    expect(json.crossQuote.rate).toBe('0.88');
  });

  it('resuelve par cruzado directo del catálogo', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst
      .mockResolvedValueOnce({
        cuentaId: 'origen', tenantId: 'tenant-1', isActive: true,
        saldo: 1000, moneda: 'EUR', nombreBanco: 'B1',
      })
      .mockResolvedValueOnce({
        cuentaId: 'destino', tenantId: 'tenant-1', isActive: true,
        saldo: 500, moneda: 'GBP', nombreBanco: 'B2',
      });
    tenantAccountingPolicyFindUnique.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });
    const vigencia = new Date('2026-01-01T00:00:00.000Z');
    tasaCambioFindFirst.mockImplementation(async ({ where }: any) => {
      const key = `${where.monedaOrigenId}→${where.monedaDestino}`;
      if (key === 'EUR→GBP') return { tasaId: 't-direct', tasa: new Prisma.Decimal('0.85'), fechaVigencia: vigencia };
      if (key === 'EUR→USD') return { tasaId: 't-eur-usd', tasa: new Prisma.Decimal('1.1'), fechaVigencia: vigencia };
      return null;
    });

    await AccountingOperationsMutationService.createBankTransfer({
      input: {
        cuentaOrigenId: 'origen', cuentaDestinoId: 'destino',
        montoOrigen: 100, motivo: 'Cruce directo',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    const data = transferCreate.mock.calls[0][0].data as Record<string, unknown>;
    expect((data.montoDestino as Prisma.Decimal).toNumber()).toBeCloseTo(85, 4);
    expect((data.tasaCambio as Prisma.Decimal).toString()).toBe('0.85');
    const json = data.fxEvidenceJson as Record<string, any>;
    expect(json.crossQuote).toMatchObject({ kind: 'DIRECT', catalogRateIds: ['t-direct'] });
  });

  it('rechaza montoDestino inconsistente con la cotización cruzada', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    findFirst
      .mockResolvedValueOnce({
        cuentaId: 'origen', tenantId: 'tenant-1', isActive: true,
        saldo: 1000, moneda: 'EUR', nombreBanco: 'B1',
      })
      .mockResolvedValueOnce({
        cuentaId: 'destino', tenantId: 'tenant-1', isActive: true,
        saldo: 500, moneda: 'GBP', nombreBanco: 'B2',
      });
    tenantAccountingPolicyFindUnique.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });
    const vigencia = new Date('2026-01-01T00:00:00.000Z');
    tasaCambioFindFirst.mockImplementation(async ({ where }: any) => {
      const key = `${where.monedaOrigenId}→${where.monedaDestino}`;
      if (key === 'EUR→USD') return { tasaId: 't-eur-usd', tasa: new Prisma.Decimal('1.1'), fechaVigencia: vigencia };
      if (key === 'GBP→USD') return { tasaId: 't-gbp-usd', tasa: new Prisma.Decimal('1.25'), fechaVigencia: vigencia };
      return null;
    });

    await expect(AccountingOperationsMutationService.createBankTransfer({
      input: {
        cuentaOrigenId: 'origen', cuentaDestinoId: 'destino',
        montoOrigen: 100, montoDestino: 90, motivo: 'Cruce con destino erróneo',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(transferCreate).not.toHaveBeenCalled();
  });
});
