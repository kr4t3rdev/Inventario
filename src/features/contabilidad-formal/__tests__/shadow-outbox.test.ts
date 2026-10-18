import { describe, expect, it, vi } from 'vitest';

import { registrarResultadoShadow } from '../services/shadow-outbox';

describe('registrarResultadoShadow', () => {
  it('writes unique tenant/event/origin evidence idempotently in the writer transaction', async () => {
    const tx = { shadowPosteoOutbox: { upsert: vi.fn().mockResolvedValue(undefined) } };

    await registrarResultadoShadow(tx as never, {
      tenantId: 'tenant-a',
      tipoEvento: 'PAGO_DEUDA',
      origenTipo: 'reconciliacion_gasto',
      origenId: 'recon-1',
      estado: 'SIMULADO',
      duracionMs: 4,
    });

    expect(tx.shadowPosteoOutbox.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_tipoEvento_origenTipo_origenId: {
          tenantId: 'tenant-a',
          tipoEvento: 'PAGO_DEUDA',
          origenTipo: 'reconciliacion_gasto',
          origenId: 'recon-1',
        },
      },
      create: {
        tenantId: 'tenant-a',
        tipoEvento: 'PAGO_DEUDA',
        origenTipo: 'reconciliacion_gasto',
        origenId: 'recon-1',
        estado: 'SIMULADO',
        duracionMs: 4,
      },
      update: {},
    });
  });
});
