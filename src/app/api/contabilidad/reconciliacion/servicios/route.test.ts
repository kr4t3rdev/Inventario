import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { authUser, reconcileService } = vi.hoisted(() => ({
  authUser: {
    userId: 'manager-1',
    tenantId: 'tenant-1',
    tenantRole: 'manager',
    planFeatures: { servicios: true },
    permissions: new Set(['financiero.contabilidad.acceder']),
  },
  reconcileService: vi.fn(),
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({ user: authUser })),
}));
vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  AccountingReconciliationService: { reconcileService },
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn((body: Record<string, unknown>) => body.fechaReconciliacion ?? null),
  validarEscrituraPeriodo: vi.fn(async () => ({ permitido: true })),
}));
vi.mock('@/lib/prisma', () => ({
  default: { ventaServicios: { findMany: vi.fn(), count: vi.fn() } },
}));

import { POST } from './route';

/** @description Crea una petición de reconciliación web con un pago recibido en USD. */
function requestPago(): NextRequest {
  return new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios', {
    method: 'POST',
    body: JSON.stringify({
      ventaServicioId: 'venta-servicio-1',
      cuentaId: 'cuenta-usd',
      tipoPagoId: 'transferencia',
      monto: 40,
      moneda: 'USD',
      tasaCambio: 25,
      tasaEfectivaEn: '2026-10-03T12:00:00.000Z',
      fechaReconciliacion: '2026-10-03T12:00:00.000Z',
    }),
  });
}

describe('POST reconciliación de servicios web', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reconcileService.mockResolvedValue({
      reconciliado: false,
      distribuciones: 1,
      reconciliaciones: [{ reconciliacionId: 'rec-service-1' }],
    });
  });

  it('delega el cobro al workflow compartido conservando valoración y respuesta compatible', async () => {
    const response = await POST(requestPago());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(reconcileService).toHaveBeenCalledWith({
      user: authUser,
      input: {
        ventaServicioId: 'venta-servicio-1',
        fechaReconciliacion: '2026-10-03T12:00:00.000Z',
        distribuciones: [{
          cuentaId: 'cuenta-usd',
          tipoPagoId: 'transferencia',
          monto: 40,
          moneda: 'USD',
          tasaCambio: 25,
          fechaTasa: '2026-10-03T12:00:00.000Z',
          observaciones: undefined,
        }],
      },
    });
    expect(body).toMatchObject({
      reconciliado: false,
      distribuciones: 1,
      reconciliacion: { reconciliacionId: 'rec-service-1' },
    });
  });
});
