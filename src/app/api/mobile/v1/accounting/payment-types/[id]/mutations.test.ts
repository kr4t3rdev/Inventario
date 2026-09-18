import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/api/contabilidad/tipos-pago/[id]/route', () => ({
  PUT: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
  DELETE: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

import { DELETE as mobileDelete, PUT as mobilePut } from './route';
import { DELETE as webDelete, PUT as webPut } from '@/app/api/contabilidad/tipos-pago/[id]/route';

describe('mobile accounting payment type mutations', () => {
  it('delegates update to the canonical web handler', async () => {
    const request = new Request('http://localhost', { method: 'PUT', body: '{}' });
    const context = { params: Promise.resolve({ id: 'tp-1' }) };
    const response = await mobilePut(request, context);
    expect(response.status).toBe(200);
    expect(webPut).toHaveBeenCalledWith(request, context);
  });

  it('delegates deletion to the canonical web handler', async () => {
    const request = new Request('http://localhost', { method: 'DELETE' });
    const context = { params: Promise.resolve({ id: 'tp-1' }) };
    const response = await mobileDelete(request, context);
    expect(response.status).toBe(200);
    expect(webDelete).toHaveBeenCalledWith(request, context);
  });
});
