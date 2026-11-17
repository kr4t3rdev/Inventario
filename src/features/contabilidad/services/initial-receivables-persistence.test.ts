import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistInitialReceivables } from './initial-receivables-persistence';

vi.mock('./accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: vi.fn() }));

const tx = {
  inicializacionContable: { findFirst: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
  moneda: { findMany: vi.fn() },
  cliente: { findMany: vi.fn() },
  cuentaPorCobrar: { createMany: vi.fn() },
};
const valid = {
  tenantId: 'tenant-a', inicializacionId: 'init-a',
  cuentas: [{ referenciaFila: 'fila-1', clienteId: 'cliente-a', moneda: 'CUP', saldo: '125.25' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.inicializacionContable.findFirst.mockResolvedValue({ inicializacionId: 'init-a' });
  tx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
  tx.moneda.findMany.mockResolvedValue([{ codigo: 'CUP' }]);
  tx.cliente.findMany.mockResolvedValue([{ clienteId: 'cliente-a' }]);
  tx.cuentaPorCobrar.createMany.mockResolvedValue({ count: 1 });
});

describe('persistencia interna de CxC iniciales', () => {
  it('guarda el saldo sin factura ni venta con origen y valoración funcional identificables', async () => {
    await expect(persistInitialReceivables(tx as never, valid)).resolves.toEqual({ count: 1 });
    expect(tx.cuentaPorCobrar.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({
      tenantId: 'tenant-a', clienteId: 'cliente-a', inicializacionId: 'init-a',
      referenciaInicial: 'fila-1', tipoCuenta: 'APERTURA_EXTERNA',
      montoDeuda: '125.25', montoOriginal: '125.25', montoDeudaFuncional: '125.25',
      montoPagado: '0', montoPagadoFuncional: '0', monedaOriginal: 'CUP', monedaFuncional: 'CUP',
      facturaId: null, ventaServicioId: null,
    })] });
  });

  it('rechaza inicialización de otro tenant o no activa', async () => {
    tx.inicializacionContable.findFirst.mockResolvedValue(null);
    await expect(persistInitialReceivables(tx as never, valid)).rejects.toThrow();
    expect(tx.inicializacionContable.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { inicializacionId: 'init-a', tenantId: 'tenant-a', estado: 'EN_PROGRESO' },
    }));
    expect(tx.cuentaPorCobrar.createMany).not.toHaveBeenCalled();
  });

  it('rechaza clientes que no pertenecen al tenant antes de escribir', async () => {
    tx.cliente.findMany.mockResolvedValue([]);
    await expect(persistInitialReceivables(tx as never, valid)).rejects.toThrow();
    expect(tx.cliente.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a', clienteId: { in: ['cliente-a'] } },
    }));
    expect(tx.cuentaPorCobrar.createMany).not.toHaveBeenCalled();
  });

  it('rechaza divisa extranjera sin valoración comprobada', async () => {
    await expect(persistInitialReceivables(tx as never, { ...valid, cuentas: [
      { ...valid.cuentas[0], moneda: 'USD' },
    ] })).rejects.toThrow();
    expect(tx.cuentaPorCobrar.createMany).not.toHaveBeenCalled();
  });

  it('rechaza divisas inactivas y política ausente sin escribir', async () => {
    tx.moneda.findMany.mockResolvedValue([]);
    await expect(persistInitialReceivables(tx as never, valid)).rejects.toThrow();
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    await expect(persistInitialReceivables(tx as never, valid)).rejects.toThrow();
    expect(tx.cuentaPorCobrar.createMany).not.toHaveBeenCalled();
  });

  it('rechaza filas repetidas sin escribir', async () => {
    await expect(persistInitialReceivables(tx as never, {
      ...valid, cuentas: [valid.cuentas[0], valid.cuentas[0]],
    })).rejects.toThrow();
    expect(tx.cuentaPorCobrar.createMany).not.toHaveBeenCalled();
  });
});
