import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
const update = vi.fn();
const findUnique = vi.fn();
const findFirst = vi.fn();
const transaction = vi.fn();
const acquireAccountingTenantLock = vi.fn();
const capitalCreate = vi.fn();
const capitalFindUnique = vi.fn();
const capitalGlobalFindUnique = vi.fn();
const adjustmentFindUnique = vi.fn();
const inyeccionFindFirst = vi.fn();
const inyeccionUpdate = vi.fn();
const pagoCreate = vi.fn();
const auditLogCreate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findUnique, findFirst },
    inyeccionCapital: { findUnique: capitalGlobalFindUnique },
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
    capitalFindUnique.mockResolvedValue(null);
    capitalGlobalFindUnique.mockResolvedValue(null);
    adjustmentFindUnique.mockResolvedValue(null);
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
      ajusteBancario: { create, findUnique: adjustmentFindUnique },
      cuentaBancaria: { findFirst, update, updateMany: update },
      inyeccionCapital: {
        create: capitalCreate,
        findFirst: inyeccionFindFirst,
        findUnique: capitalFindUnique,
        update: inyeccionUpdate,
      },
      pagoDeuda: { create: pagoCreate },
      auditLog: { create: auditLogCreate },
    }));
  });

  it('preserves the supplied FX rate in a capital injection payload', async () => {
    const { createCapitalInjectionSchema } = await import('../accounting-operations-mutation-service');
    const parsed = createCapitalInjectionSchema.parse({
      montoRecibido: 1,
      moneda: 'USD',
      tipo: 'CAPITAL_SOCIAL',
      cuentaId: 'account-1',
      socio: 'Partner',
      tasaCambio: 300,
      idempotencyKey: 'capital-rate-key',
    });

    expect(parsed.tasaCambio).toBe(300);
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
        fechaOperacion,
      }),
    });
    expect(String(create.mock.calls[0][0].data.montoConvertido)).toBe('100');
    expect(String(create.mock.calls[0][0].data.tasaCambio)).toBe('1');
  });

  it('persists an adjustment key and replays an exact request without repeating effects', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const input = {
      cuentaId: 'account-1',
      tipo: 'ingreso' as const,
      monto: 25,
      moneda: 'CUP',
      descripcion: 'Ajuste',
      motivo: 'Corrección',
      idempotencyKey: 'adjustment-key',
    };

    await AccountingOperationsMutationService.createBankAdjustment({
      input,
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ idempotencyKey: 'adjustment-key', payloadFingerprint: expect.any(String) }),
    });
    const persisted = {
      ajusteId: 'adjustment-1',
      cuentaId: 'account-1',
      ...create.mock.calls[0][0].data,
    };
    adjustmentFindUnique.mockResolvedValueOnce(persisted);

    await AccountingOperationsMutationService.createBankAdjustment({
      input,
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(create).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
  });

  it('rejects an omitted adjustment date when the original keyed request specified one', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const input = {
      cuentaId: 'account-1',
      tipo: 'ingreso' as const,
      monto: 25,
      moneda: 'CUP',
      descripcion: 'Ajuste',
      motivo: 'Corrección',
      fechaOperacion: new Date('2026-10-01T12:00:00.000Z'),
      idempotencyKey: 'adjustment-date-key',
    };
    await AccountingOperationsMutationService.createBankAdjustment({
      input,
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });
    adjustmentFindUnique.mockResolvedValueOnce({
      ajusteId: 'adjustment-1',
      cuentaId: 'account-1',
      ...create.mock.calls[0][0].data,
    });

    await expect(AccountingOperationsMutationService.createBankAdjustment({
      input: { ...input, fechaOperacion: undefined },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(create).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
  });

  it('replays repeated adjustment requests with an omitted date from their persisted fingerprint', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const input = {
      cuentaId: 'account-1',
      tipo: 'ingreso' as const,
      monto: 25,
      moneda: 'CUP',
      descripcion: 'Ajuste sin fecha explícita',
      motivo: 'Reintento',
      idempotencyKey: 'adjustment-omitted-date-key',
    };
    await AccountingOperationsMutationService.createBankAdjustment({
      input,
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });
    adjustmentFindUnique.mockResolvedValueOnce({
      ajusteId: 'adjustment-2',
      cuentaId: 'account-1',
      ...create.mock.calls[0][0].data,
    });

    await expect(AccountingOperationsMutationService.createBankAdjustment({
      input,
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).resolves.toMatchObject({ ajuste: { ajusteId: 'adjustment-2' } });
    expect(create).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
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
        idempotencyKey: 'capital-create-key',
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
        moneda: 'CUP',
        cuentaId: 'account-1',
        socio: 'Socio fundador',
        entidadPrestamista: null,
      }),
    });
    expect(String(capitalCreate.mock.calls[0][0].data.montoRecibido)).toBe('250');
    expect(capitalCreate.mock.calls[0][0].data).not.toHaveProperty('monto');
    expect(capitalCreate.mock.calls[0][0].data).not.toHaveProperty('cuentaBancariaId');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { cuentaId: 'account-1' },
      data: { saldo: { increment: expect.anything() } },
    });
    expect(String(update.mock.calls[0][0].data.saldo.increment)).toBe('250');
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
        idempotencyKey: 'capital-debt-key',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(capitalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'DEUDA_EXTERNA',
        tasaInteres: 10,
        plazoMeses: 12,
        entidadPrestamista: 'Financiera externa',
        socio: null,
        estado: 'ACTIVA',
      }),
    });
    const debtData = capitalCreate.mock.calls[0][0].data;
    expect(String(debtData.montoRecibido)).toBe('1000');
    expect(String(debtData.montoInteres)).toBe('100');
    expect(String(debtData.montoTotalDeuda)).toBe('1100');
    expect(String(debtData.saldoPendiente)).toBe('1100');
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
        idempotencyKey: 'capital-missing-account-key',
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
        idempotencyKey: 'capital-inactive-account-key',
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
        idempotencyKey: 'capital-currency-mismatch-key',
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
        idempotencyKey: 'capital-audit-rollback-key',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toThrow('audit failed');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalled();
  });

  it('persists a capital key and fingerprint and replays it without repeating effects', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const input = {
      montoRecibido: 250,
      moneda: 'CUP',
      tipo: 'CAPITAL_SOCIAL' as const,
      cuentaId: 'account-1',
      socio: 'Socio fundador',
      idempotencyKey: 'capital-key',
    };

    await AccountingOperationsMutationService.createCapitalInjection({
      input,
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });
    expect(capitalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: 'capital-key',
        payloadFingerprint: expect.any(String),
      }),
    });
    const persisted = { id: 'capital-1', ...capitalCreate.mock.calls[0][0].data };
    capitalFindUnique.mockResolvedValueOnce(persisted);

    await AccountingOperationsMutationService.createCapitalInjection({
      input,
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(capitalCreate).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(auditLogCreate).toHaveBeenCalledOnce();
  });

  it('recovers only a matching capital replay after the tenant-key unique race', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const input = {
      montoRecibido: 250,
      moneda: 'CUP',
      tipo: 'CAPITAL_SOCIAL' as const,
      cuentaId: 'account-1',
      socio: 'Socio para retry',
      idempotencyKey: 'capital-p2002-key',
    };
    await AccountingOperationsMutationService.createCapitalInjection({
      input,
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });
    const persisted = {
      id: 'capital-race-row',
      ...capitalCreate.mock.calls[0][0].data,
    };
    capitalGlobalFindUnique.mockResolvedValueOnce(persisted);
    transaction.mockRejectedValueOnce({
      code: 'P2002',
      meta: { target: ['tenantId', 'idempotencyKey'] },
    });

    await expect(AccountingOperationsMutationService.createCapitalInjection({
      input,
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).resolves.toMatchObject({ id: 'capital-race-row' });
    expect(capitalCreate).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(auditLogCreate).toHaveBeenCalledOnce();
  });

  it('persiste la fecha de operación que fue validada por el período', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const fechaOperacion = new Date('2026-01-15T12:00:00.000Z');

    await AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 250,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1',
        socio: 'Socio fundador',
        fechaOperacion,
        idempotencyKey: 'capital-operation-date-key',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(capitalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fechaRegistro: fechaOperacion,
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
