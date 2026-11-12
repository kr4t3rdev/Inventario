/**
 * @description Tests F-6: getEstadoDeCuentaClienteAction.
 *
 * Contrato del spec estado-cuenta-cliente:
 * - Compone en un solo resultado (todo tenant-scoped): empresa, cliente,
 *   generadoEn, resumen (deudaTotal, deudaVencida, saldoAFavor por origen,
 *   saldoNeto), CxC enriquecidas, anticipos, notas de crédito, facturas y
 *   pagos. `desde` aplica a CxC, facturas e historial de pagos.
 * - Escenario del spec: CxC vencida 1000 + anticipo activo 200 + NC con
 *   saldo a favor 100 → deudaTotal 1000, saldoAFavor 300, saldoNeto 700.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    miEmpresa: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    cuentaPorCobrar: { findMany: vi.fn() },
    anticipo: { findMany: vi.fn() },
    devolucionVenta: { findMany: vi.fn() },
    factura: { findMany: vi.fn() },
    reconciliacionVenta: { findMany: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getEstadoDeCuentaClienteAction } from '../actions-cuentas';

const user = {
  userId: 'user-1',
  role: 'admin',
  tenantId: 'tenant-1',
  tenantRole: 'admin',
  isActive: true,
} as any;

const empresa = {
  id: 1,
  nombre: 'Empresa ACME',
  propietario: 'Propietario',
  direccion: 'Calle 1',
  telefono: '555-1234',
  email: 'acme@empresa.com',
};

const cliente = {
  clienteId: 'cli-1',
  nombre: 'Cliente Uno',
  telefono: '123-4567',
  direccion: 'Avenida Siempre Viva',
};

/** CxC vencida de 1000 sin factura: saldo = montoDeuda − montoPagado. */
const cxcVencida = {
  id: 'cxc-1',
  idCC: 1,
  facturaId: null,
  numeroFactura: 'F-001',
  clienteId: 'cli-1',
  montoDeuda: 1000,
  montoPagado: 0,
  // La CxC real no tiene columna `moneda`: la moneda vive en monedaOriginal.
  monedaOriginal: 'CUP',
  idTransferencia: null,
  estado: 'PENDIENTE',
  tipoCuenta: null,
  fechaVencimiento: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-02-01T00:00:00Z'),
  cliente: { clienteId: 'cli-1', nombre: 'Cliente Uno' },
  factura: null,
  prestamoCash: null,
};

const anticipoActivo = {
  anticipoId: 'ant-1',
  tipo: 'COBRO',
  estado: 'RESERVADO',
  montoOriginal: 200,
  saldoDisponible: 200,
  moneda: 'CUP',
  referenciaExterna: null,
  fechaReserva: new Date('2026-02-10T00:00:00Z'),
};

const notaCreditoSaldoFavor = {
  devolucionId: 'dv-1',
  ventaId: 'v-1',
  estado: 'REGISTRADA',
  moneda: 'CUP',
  anticipoId: null,
  total: 100,
  montoAplicadoCxc: 0,
  montoSaldoFavor: 100,
  createdAt: new Date('2026-02-15T00:00:00Z'),
};

const pago = {
  reconciliacionId: 'rec-1',
  monto: 500,
  moneda: 'CUP',
  montoConvertido: 500,
  fechaReconciliacion: new Date('2026-02-20T00:00:00Z'),
  observaciones: 'Pago parcial',
  tipoPago: { nombre: 'Efectivo' },
};

describe('F-6: getEstadoDeCuentaClienteAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.miEmpresa.findFirst).mockResolvedValue(empresa as any);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(cliente as any);
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([cxcVencida] as any);
    vi.mocked(prisma.anticipo.findMany).mockResolvedValue([anticipoActivo] as any);
    vi.mocked(prisma.devolucionVenta.findMany).mockResolvedValue([
      notaCreditoSaldoFavor,
    ] as any);
    vi.mocked(prisma.factura.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([pago] as any);
  });

  it('compone el resumen del spec: deudaTotal 1000, saldoAFavor 300, saldoNeto 700', async () => {
    const result = await getEstadoDeCuentaClienteAction({ clienteId: 'cli-1' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data;
    expect(data.empresa?.nombre).toBe('Empresa ACME');
    expect(data.cliente).toEqual(
      expect.objectContaining({ clienteId: 'cli-1', nombre: 'Cliente Uno' }),
    );
    expect(data.resumen).toEqual({
      porMoneda: [{
        moneda: 'CUP',
        deudaTotal: 1000,
        deudaVencida: 1000,
        saldoAFavorAnticipos: 200,
        saldoAFavorNotasCredito: 100,
        saldoAFavor: 300,
        saldoNeto: 700,
      }],
    });
    // El detalle lista CxC, anticipos y NC separados.
    expect(data.cuentasPorCobrar).toHaveLength(1);
    expect(data.cuentasPorCobrar[0]).toEqual(
      expect.objectContaining({ id: 'cxc-1', saldoFactura: 1000 }),
    );
    expect(data.anticipos).toEqual([
      expect.objectContaining({ anticipoId: 'ant-1', saldoDisponible: 200 }),
    ]);
    expect(data.notasCredito).toEqual([
      expect.objectContaining({ devolucionId: 'dv-1', montoSaldoFavor: 100 }),
    ]);
    expect(data.pagos).toEqual([
      expect.objectContaining({ reconciliacionId: 'rec-1', monto: 500 }),
    ]);
  });

  it('mantiene el resumen separado por moneda para no sumar saldos incompatibles', async () => {
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([
      cxcVencida,
      { ...cxcVencida, id: 'cxc-usd', monedaOriginal: 'USD', montoDeuda: 100, montoPagado: 0 },
    ] as any);
    vi.mocked(prisma.anticipo.findMany).mockResolvedValue([
      anticipoActivo,
      { ...anticipoActivo, anticipoId: 'ant-usd', moneda: 'USD', saldoDisponible: 20 },
    ] as any);
    vi.mocked(prisma.devolucionVenta.findMany).mockResolvedValue([
      notaCreditoSaldoFavor,
      { ...notaCreditoSaldoFavor, devolucionId: 'dv-usd', moneda: 'USD', montoSaldoFavor: 10 },
    ] as any);

    const result = await getEstadoDeCuentaClienteAction({ clienteId: 'cli-1' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.resumen.porMoneda).toEqual([
      expect.objectContaining({
        moneda: 'CUP', deudaTotal: 1000, saldoAFavor: 300, saldoNeto: 700,
      }),
      expect.objectContaining({
        moneda: 'USD', deudaTotal: 100, saldoAFavor: 30, saldoNeto: 70,
      }),
    ]);
  });

  it('no duplica el saldo a favor de una NC materializada como anticipo', async () => {
    // La NC dv-1 tiene saldo 100 y su anticipo 'ant-nc' es el vehículo
    // vivo de ese mismo saldo: el resumen debe contar 100 una sola vez.
    vi.mocked(prisma.anticipo.findMany).mockResolvedValue([
      anticipoActivo,
      {
        ...anticipoActivo,
        anticipoId: 'ant-nc',
        referenciaExterna: 'NC:dv-1',
        saldoDisponible: 100,
      },
    ] as any);
    vi.mocked(prisma.devolucionVenta.findMany).mockResolvedValue([
      { ...notaCreditoSaldoFavor, anticipoId: 'ant-nc' },
    ] as any);

    const result = await getEstadoDeCuentaClienteAction({ clienteId: 'cli-1' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.resumen).toEqual({
      porMoneda: [{
        moneda: 'CUP',
        deudaTotal: 1000,
        deudaVencida: 1000,
        saldoAFavorAnticipos: 300,
        saldoAFavorNotasCredito: 0,
        saldoAFavor: 300,
        saldoNeto: 700,
      }],
    });
    // La NC vinculada se representa solo con el saldo vivo del anticipo.
    expect(result.data.notasCredito).toEqual([]);
  });

  it('muestra solo el saldo vivo del anticipo para una nota de crédito vinculada', async () => {
    vi.mocked(prisma.anticipo.findMany).mockResolvedValue([
      {
        ...anticipoActivo,
        anticipoId: 'ant-nc',
        referenciaExterna: 'NC:dv-1',
        saldoDisponible: 50,
      },
    ] as any);
    vi.mocked(prisma.devolucionVenta.findMany).mockResolvedValue([
      { ...notaCreditoSaldoFavor, anticipoId: 'ant-nc', montoSaldoFavor: 100 },
    ] as any);

    const result = await getEstadoDeCuentaClienteAction({ clienteId: 'cli-1' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.resumen.porMoneda).toEqual([
      expect.objectContaining({
        moneda: 'CUP',
        saldoAFavorAnticipos: 50,
        saldoAFavorNotasCredito: 0,
        saldoAFavor: 50,
        saldoNeto: 950,
      }),
    ]);
    expect(result.data.anticipos).toEqual([
      expect.objectContaining({ anticipoId: 'ant-nc', saldoDisponible: 50 }),
    ]);
    expect(result.data.notasCredito).toEqual([]);
  });

  it('una CxC sin monedaOriginal cae en el bucket CUP, nunca en DOP', async () => {
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([
      { ...cxcVencida, monedaOriginal: null },
    ] as any);
    vi.mocked(prisma.anticipo.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.devolucionVenta.findMany).mockResolvedValue([] as any);

    const result = await getEstadoDeCuentaClienteAction({ clienteId: 'cli-1' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.resumen.porMoneda).toEqual([
      expect.objectContaining({ moneda: 'CUP', deudaTotal: 1000 }),
    ]);
    expect(result.data.resumen.porMoneda.map((r) => r.moneda)).not.toContain('DOP');
    expect(result.data.cuentasPorCobrar[0].moneda).toBe('CUP');
  });

  it('rechaza FORBIDDEN el estado de cuenta a un no-admin sin financiero.contabilidad.acceder', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...user,
      role: 'user',
      tenantRole: 'dependiente',
      permissions: new Set(),
      planFeatures: { 'cuentas-cobrar': true },
    });

    const result = await getEstadoDeCuentaClienteAction({ clienteId: 'cli-1' });

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('FORBIDDEN');
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('permite el estado de cuenta a un no-admin con financiero.contabilidad.acceder', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...user,
      role: 'user',
      tenantRole: 'dependiente',
      permissions: new Set(['financiero.contabilidad.acceder']),
      planFeatures: { 'cuentas-cobrar': true },
    });

    const result = await getEstadoDeCuentaClienteAction({ clienteId: 'cli-1' });

    expect(result.success).toBe(true);
  });

  it('no vence una CxC sin fecha de vencimiento (deudaVencida 0)', async () => {
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([
      { ...cxcVencida, fechaVencimiento: null, numeroFactura: 'F-002' },
    ] as any);

    const result = await getEstadoDeCuentaClienteAction({ clienteId: 'cli-1' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resumen.porMoneda[0].deudaVencida).toBe(0);
      expect(result.data.resumen.porMoneda[0].deudaTotal).toBe(1000);
    }
  });

  it('falla NOT_FOUND si el cliente no existe en el tenant', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null as any);

    const result = await getEstadoDeCuentaClienteAction({
      clienteId: 'cli-ajeno',
    });

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('NOT_FOUND');
  });

  it('solo considera CxC activas (PENDIENTE/PARCIAL), anticipos COBRO con saldo y NC con saldo a favor', async () => {
    await getEstadoDeCuentaClienteAction({ clienteId: 'cli-1' });

    expect(prisma.cuentaPorCobrar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          clienteId: 'cli-1',
          estado: { in: ['PENDIENTE', 'PARCIAL'] },
        }),
      }),
    );
    expect(prisma.anticipo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          clienteId: 'cli-1',
          tipo: 'COBRO',
          estado: { not: 'ANULADO' },
          saldoDisponible: { gt: 0 },
        }),
      }),
    );
    expect(prisma.devolucionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          venta: { clienteId: 'cli-1' },
          estado: { not: 'ANULADA' },
          montoSaldoFavor: { gt: 0 },
        }),
      }),
    );
    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          venta: { clienteId: 'cli-1' },
        }),
      }),
    );
    expect(prisma.factura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', clienteId: 'cli-1' }),
      }),
    );
  });

  it('`desde` filtra CxC (createdAt), facturas (fechaEmision) e historial de pagos', async () => {
    await getEstadoDeCuentaClienteAction({
      clienteId: 'cli-1',
      desde: '2026-02-01T00:00:00.000Z',
    });

    expect(prisma.cuentaPorCobrar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date('2026-02-01T00:00:00.000Z') },
        }),
      }),
    );
    expect(prisma.factura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaEmision: { gte: new Date('2026-02-01T00:00:00.000Z') },
        }),
      }),
    );
    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaReconciliacion: { gte: new Date('2026-02-01T00:00:00.000Z') },
        }),
      }),
    );
  });

  it('rechaza `desde` inválido con VALIDATION_ERROR', async () => {
    const result = await getEstadoDeCuentaClienteAction({
      clienteId: 'cli-1',
      desde: 'no-es-una-fecha',
    });
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('VALIDATION_ERROR');
  });
});
