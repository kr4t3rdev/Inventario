import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
const update = vi.fn();
const findUnique = vi.fn();
const findFirst = vi.fn();
const transaction = vi.fn();
const acquireAccountingTenantLock = vi.fn();
const capitalCreate = vi.fn();
const inyeccionFindFirst = vi.fn();
const inyeccionUpdate = vi.fn();
const pagoCreate = vi.fn();
const auditLogCreate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findUnique, findFirst },
    $transaction: transaction,
  },
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: auditLogCreate },
}));

vi.mock('../accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock,
}));

describe('AccountingOperationsMutationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      ajusteBancario: { create },
      cuentaBancaria: { findFirst, update },
      inyeccionCapital: { create: capitalCreate, findFirst: inyeccionFindFirst, update: inyeccionUpdate },
      pagoDeuda: { create: pagoCreate },
      auditLog: { create: auditLogCreate },
    }));
  });

  it('persiste la fecha de operación elegida para el ajuste', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const fechaOperacion = '2026-01-15T12:00:00.000Z';

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
        montoConvertido: 100,
        tasaCambio: 1,
        fechaOperacion: new Date(fechaOperacion),
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
        montoRecibido: 250,
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
        montoRecibido: 1000,
        tasaInteres: 10,
        montoInteres: 100,
        montoTotalDeuda: 1100,
        saldoPendiente: 1100,
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
      select: { id: true, tipo: true, saldoPendiente: true, pagos: { select: { id: true } } },
    });
    // Escribe solo columnas reales del modelo PagoDeuda.
    const pagoData = pagoCreate.mock.calls[0][0].data as Record<string, unknown>;
    expect(pagoData).toMatchObject({
      tenantId: 'tenant-1',
      inyeccionId: 'inyeccion-1',
      montoPagado: 300,
      cuentaId: 'account-1',
      numeroCuota: 1,
      observaciones: 'Primera cuota',
    });
    expect(pagoData).not.toHaveProperty('monto');
    expect(pagoData).not.toHaveProperty('cuentaBancariaId');
    expect(pagoData).not.toHaveProperty('tipoPagoId');
    // Descuenta saldo de cuenta y saldo pendiente de la deuda.
    expect(update).toHaveBeenCalledWith({
      where: { cuentaId: 'account-1' },
      data: { saldo: { decrement: 300 } },
    });
    expect(inyeccionUpdate).toHaveBeenCalledWith({
      where: { id: 'inyeccion-1' },
      data: expect.objectContaining({ saldoPendiente: { decrement: 300 } }),
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
});
