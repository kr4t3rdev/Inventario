/**
 * @description Tests F-4: gastos recurrentes (GastoRecurrente → GastosDE).
 *
 * Contrato del spec gastos-recurrentes-adjuntos:
 * - Generación idempotente por período (clave `rec:{plantillaId}:{periodo}`).
 * - Avanza proximaGeneracion según la frecuencia.
 * - Los GastosDE generados nacen PENDIENTE y vinculados a la plantilla.
 * - CRUD de plantillas con diaGeneracion 1-28 y gating por feature gastos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockTx = {
  gastosDE: { findUnique: vi.fn(), create: vi.fn() },
  gastoRecurrente: { update: vi.fn() },
  vendor: { findFirst: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    gastosDE: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    gastoRecurrente: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    gastoConcepto: { findFirst: vi.fn(), create: vi.fn() },
    gastoElemento: { findFirst: vi.fn() },
    empleado: { findFirst: vi.fn() },
    vendor: { findFirst: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  crearGastoRecurrenteAction,
  generarGastosRecurrentesAction,
  ensureConceptoViaticos,
} from '../recurrentes';

const user = {
  userId: 'user-1',
  role: 'admin',
  tenantId: 'tenant-1',
  tenantRole: 'admin',
  isActive: true,
  planFeatures: { gastos: true },
} as any;

/** Plantilla mensual vencida: debía generarse el 5 de septiembre de 2026. */
const plantillaMensual = {
  gastoRecurrenteId: 'GR-1',
  tenantId: 'tenant-1',
  nombre: 'Alquiler depósito',
  conceptoId: null,
  elementoId: null,
  proveedorId: null,
  empleadoId: null,
  monto: 50000,
  moneda: 'CUP',
  frecuencia: 'MENSUAL',
  diaGeneracion: 5,
  proximaGeneracion: new Date('2026-09-05T00:00:00Z'),
  activo: true,
};

describe('F-4: generarGastosRecurrentesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.gastoRecurrente.findMany).mockResolvedValue([
      plantillaMensual,
    ] as any);
    vi.mocked(prisma.gastosDE.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.gastosDE.create).mockResolvedValue({
      gastosDEId: 'gde-1',
    } as any);
    mockTx.gastoRecurrente.update.mockResolvedValue({} as any);
  });

  it('genera el gasto del período con clave idempotente y avanza un mes', async () => {
    const result = await generarGastosRecurrentesAction({});

    expect(result.success).toBe(true);
    // El create ocurre dentro de la transacción (tx mockeada).
    expect(mockTx.gastosDE.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        estado: 'PENDIENTE',
        periodo: '2026-09',
        monto: 500,
        gastoRecurrenteId: 'GR-1',
        claveIdempotencia: 'rec:GR-1:2026-09',
      }),
    });
    expect(mockTx.gastoRecurrente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gastoRecurrenteId: 'GR-1' },
        data: expect.objectContaining({
          proximaGeneracion: expect.anything(),
        }),
      }),
    );
  });

  it('re-ejecución idempotente: si la clave existe no duplica', async () => {
    vi.mocked(prisma.gastosDE.findUnique).mockResolvedValue({
      gastosDEId: 'gde-existente',
    } as any);

    const result = await generarGastosRecurrentesAction({});

    expect(result.success).toBe(true);
    expect(mockTx.gastosDE.create).not.toHaveBeenCalled();
    const data = result.data as any;
    expect(data.generados).toBe(0);
  });

  it('BIMESTRAL avanza proximaGeneracion dos meses', async () => {
    vi.mocked(prisma.gastoRecurrente.findMany).mockResolvedValue([
      { ...plantillaMensual, frecuencia: 'BIMESTRAL' },
    ] as any);

    await generarGastosRecurrentesAction({});

    const update = mockTx.gastoRecurrente.update.mock.calls[0][0];
    const nueva = update.data.proximaGeneracion as Date;
    expect(nueva.getUTCMonth()).toBe(10); // sept (8) + 2 = noviembre (10)
    expect(nueva.getUTCDate()).toBe(5);
  });
});

describe('F-4: crearGastoRecurrenteAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.gastoRecurrente.create).mockResolvedValue({
      gastoRecurrenteId: 'GR-2',
    } as any);
  });

  it('crea la plantilla con proximaGeneracion calculada del día de generación', async () => {
    const result = await crearGastoRecurrenteAction({
      nombre: 'Seguro flota',
      monto: 120000,
      frecuencia: 'TRIMESTRAL',
      diaGeneracion: 15,
    });

    expect(result.success).toBe(true);
    expect(prisma.gastoRecurrente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        nombre: 'Seguro flota',
        monto: 120000,
        frecuencia: 'TRIMESTRAL',
        diaGeneracion: 15,
        activo: true,
        proximaGeneracion: expect.anything(),
      }),
    });
  });

  it('fail-closed: diaGeneracion fuera de 1-28', async () => {
    const result = await crearGastoRecurrenteAction({
      nombre: 'Seguro flota',
      monto: 120000,
      frecuencia: 'MENSUAL',
      diaGeneracion: 31,
    });

    expect(result.success).toBe(false);
    expect(prisma.gastoRecurrente.create).not.toHaveBeenCalled();
  });

  it('rechaza un empleado de otro tenant al crear la plantilla', async () => {
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue(null as any);
    const result = await crearGastoRecurrenteAction({
      nombre: 'Viáticos',
      monto: 120000,
      frecuencia: 'MENSUAL',
      diaGeneracion: 15,
      empleadoId: 'empleado-ajeno',
    });

    expect(result.success).toBe(false);
    expect(prisma.gastoRecurrente.create).not.toHaveBeenCalled();
  });
});

describe('F-4: ensureConceptoViaticos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('siembra el concepto Viáticos si no existe (idempotente)', async () => {
    vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.gastoConcepto.create).mockResolvedValue({
      conceptoId: 'gc-viaticos',
      nombre: 'Viáticos',
    } as any);

    const conceptoId = await ensureConceptoViaticos(prisma as any, 'tenant-1');

    expect(prisma.gastoConcepto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', nombre: 'Viáticos' }),
    });
    expect(conceptoId).toBe('gc-viaticos');
  });

  it('reutiliza el concepto existente sin crear', async () => {
    vi.mocked(prisma.gastoConcepto.findFirst).mockResolvedValue({
      conceptoId: 'gc-existente',
    } as any);

    const conceptoId = await ensureConceptoViaticos(prisma as any, 'tenant-1');

    expect(prisma.gastoConcepto.create).not.toHaveBeenCalled();
    expect(conceptoId).toBe('gc-existente');
  });
});
