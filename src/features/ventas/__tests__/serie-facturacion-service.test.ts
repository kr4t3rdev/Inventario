/**
 * @description Tests del servicio de numeración de facturas (C-6): resolución
 * de serie (por defecto → primera → crea FV), incremento de consecutivo y
 * composición del número.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { resolverSerieYNumero } from '@/features/ventas/services/serie-facturacion-service';

function crearTx(serie: Record<string, unknown> | null) {
  return {
    serieFacturacion: {
      findFirst: vi.fn()
        .mockResolvedValueOnce(serie)
        .mockResolvedValueOnce(serie),
      create: vi.fn().mockResolvedValue({ serieId: 'serie-nueva', prefijo: 'FV', consecutivo: 1 }),
      update: vi.fn().mockResolvedValue({ serieId: 'serie-1', consecutivo: 9 }),
    },
  };
}

describe('resolverSerieYNumero (C-6)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa la serie por defecto y compone el número con el consecutivo previo', async () => {
    const tx = crearTx({ serieId: 'serie-1', prefijo: 'FV', consecutivo: 8 });

    const r = await resolverSerieYNumero(tx as never, 'tenant-1');

    expect(tx.serieFacturacion.findFirst).toHaveBeenNthCalledWith(
      1,
      { where: { tenantId: 'tenant-1', esPorDefecto: true } },
    );
    expect(tx.serieFacturacion.update).toHaveBeenCalledWith({
      where: { serieId: 'serie-1' },
      data: { consecutivo: { increment: 1 } },
    });
    expect(r).toEqual({ serieId: 'serie-1', numeroConsecutivo: 8, numeroFactura: 'FV-000008' });
  });

  it('recurre a la primera serie del tenant si no hay por defecto', async () => {
    const tx = crearTx(null);
    tx.serieFacturacion.findFirst
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ serieId: 'serie-2', prefijo: 'SRV', consecutivo: 3 });
    tx.serieFacturacion.update.mockResolvedValue({ serieId: 'serie-2', consecutivo: 4 });

    const r = await resolverSerieYNumero(tx as never, 'tenant-1');

    expect(tx.serieFacturacion.findFirst).toHaveBeenNthCalledWith(
      2,
      { where: { tenantId: 'tenant-1' }, orderBy: { createdAt: 'asc' } },
    );
    expect(r.numeroFactura).toBe('SRV-000003');
  });

  it('crea la serie FV cuando el tenant no tiene ninguna', async () => {
    const tx = crearTx(null);
    tx.serieFacturacion.findFirst.mockReset().mockResolvedValue(null);
    tx.serieFacturacion.update.mockReset().mockResolvedValue({
      serieId: 'serie-nueva',
      consecutivo: 2,
    });

    const r = await resolverSerieYNumero(tx as never, 'tenant-1');

    expect(tx.serieFacturacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', prefijo: 'FV', esPorDefecto: true }),
    });
    expect(r.numeroFactura).toBe('FV-000001');
  });
});
