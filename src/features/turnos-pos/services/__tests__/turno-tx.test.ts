/**
 * @description Tests de la resolución de turno DENTRO de la transacción de la
 * venta (tarea 3.2.c.iii): el turno AUTO se crea con el cliente transaccional,
 * de modo que si la venta se rechaza el turno no persiste huérfano. Espeja la
 * semántica de `getOrCreateTurnoActivo` (action con cliente global) pero
 * aislada por tenant explícito y sin efecto fuera de la tx.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolverTurnoDentroDeTx } from '@/features/turnos-pos/services/turno-tx';

const tx = {
  turnoPuntoVenta: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  puntoDeVenta: {
    findFirst: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolverTurnoDentroDeTx', () => {
  it('devuelve el turno ABIERTO existente del punto de venta del tenant', async () => {
    tx.turnoPuntoVenta.findFirst.mockResolvedValue({ id: 'turno-abierto' });

    const turnoId = await resolverTurnoDentroDeTx(tx as never, {
      tenantId: 'tenant-1',
      puntoDeVentaId: 'pv-1',
    });

    expect(turnoId).toBe('turno-abierto');
    expect(tx.turnoPuntoVenta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { puntoDeVentaId: 'pv-1', tenantId: 'tenant-1', estado: 'ABIERTO' },
      }),
    );
    expect(tx.turnoPuntoVenta.create).not.toHaveBeenCalled();
  });

  it('crea un turno AUTO para un PV MOVIL sin turno abierto, dentro de la tx', async () => {
    tx.turnoPuntoVenta.findFirst.mockResolvedValueOnce(null);
    tx.puntoDeVenta.findFirst.mockResolvedValue({ tipoCaja: 'MOVIL' });
    tx.turnoPuntoVenta.create.mockResolvedValue({ id: 'turno-nuevo' });

    const turnoId = await resolverTurnoDentroDeTx(tx as never, {
      tenantId: 'tenant-1',
      puntoDeVentaId: 'pv-1',
      empleadoId: 'emp-1',
    });

    expect(turnoId).toBe('turno-nuevo');
    expect(tx.turnoPuntoVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          puntoDeVentaId: 'pv-1',
          empleadoId: 'emp-1',
          estado: 'ABIERTO',
          tipo: 'AUTO',
        }),
      }),
    );
  });

  it('PV PRINCIPAL sin turno abierto devuelve null (la venta continúa sin turno)', async () => {
    tx.turnoPuntoVenta.findFirst.mockResolvedValueOnce(null);
    tx.puntoDeVenta.findFirst.mockResolvedValue({ tipoCaja: 'PRINCIPAL' });

    const turnoId = await resolverTurnoDentroDeTx(tx as never, {
      tenantId: 'tenant-1',
      puntoDeVentaId: 'pv-1',
    });

    expect(turnoId).toBeNull();
    expect(tx.turnoPuntoVenta.create).not.toHaveBeenCalled();
  });

  it('PV inexistente o ajeno al tenant rechaza con NOT_FOUND', async () => {
    tx.turnoPuntoVenta.findFirst.mockResolvedValueOnce(null);
    tx.puntoDeVenta.findFirst.mockResolvedValue(null);

    await expect(
      resolverTurnoDentroDeTx(tx as never, {
        tenantId: 'tenant-1',
        puntoDeVentaId: 'pv-ajeno',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
