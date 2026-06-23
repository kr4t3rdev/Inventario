import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    getCashLoanById: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { 'prestamos-cash': true },
};

describe('mobile cash loan comprobante route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a pdf attachment for the loan voucher', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsService.getCashLoanById).mockResolvedValue({
      id: 'prestamo-1',
      idNumerico: 42,
      cliente: { nombre: 'Cliente Demo' },
      fechaOtorgamiento: '2026-06-22T00:00:00.000Z',
      fechaVencimiento: '2026-07-22T00:00:00.000Z',
      montoCapital: 100,
      moneda: 'CUP',
      cuentaPorCobrar: { montoDeuda: 120 },
      observaciones: 'Prueba',
    } as never);

    const response = await GET(
      new Request(
        'http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/comprobante',
        {
          headers: { authorization: 'Bearer mobile-access' },
        },
      ),
      { params: Promise.resolve({ id: 'prestamo-1' }) } as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('comprobante-PREST-42.pdf');
    expect(AccountingCashOperationsService.getCashLoanById).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      id: 'prestamo-1',
    });
  });
});
