import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-operations-read-service', () => ({
  AccountingOperationsReadService: {
    getBankTransferById: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true },
};

describe('mobile bank transfer comprobante route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a pdf attachment for the transfer voucher', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsReadService.getBankTransferById).mockResolvedValue({
      transferenciaId: 't-1',
      numeroComprobante: 'TR-0001',
      fechaTransferencia: '2026-06-22T00:00:00.000Z',
      montoOrigen: 100,
      monedaOrigen: 'CUP',
      montoDestino: 100,
      monedaDestino: 'CUP',
      motivo: 'Reposición',
      descripcion: 'Prueba',
      realizadoPor: 'u1',
      cuentaOrigen: {
        nombreBanco: 'Banco A',
        numeroCuenta: '111',
        tipoCuenta: 'CORRIENTE',
        moneda: 'CUP',
      },
      cuentaDestino: {
        nombreBanco: 'Banco B',
        numeroCuenta: '222',
        tipoCuenta: 'AHORRO',
        moneda: 'CUP',
      },
    } as never);

    const response = await GET(
      new Request('http://localhost/api/mobile/v1/accounting/bank-transfers/t-1/comprobante', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
      { params: Promise.resolve({ id: 't-1' }) } as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('comprobante-TR-0001.pdf');
    expect(AccountingOperationsReadService.getBankTransferById).toHaveBeenCalledWith(
      't-1',
      'tenant-1',
    );
  });
});
