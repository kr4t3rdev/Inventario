import { describe, expect, it } from 'vitest';
import { withVentaCreateIdempotencyKey } from './venta-create-request';

describe('sale create idempotency request adapter', () => {
  it('uses and trims the body key before the header key', () => {
    expect(withVentaCreateIdempotencyKey(
      { idempotencyKey: ' body-key ', puntoDeVentaId: 'pv-1' },
      'header-key',
    )).toEqual({ idempotencyKey: 'body-key', puntoDeVentaId: 'pv-1' });
  });

  it('accepts a valid header-only key', () => {
    expect(withVentaCreateIdempotencyKey({ puntoDeVentaId: 'pv-1' }, ' header-key ')).toEqual({
      idempotencyKey: 'header-key', puntoDeVentaId: 'pv-1',
    });
  });

  it('rejects an invalid body key rather than falling back to a valid header', () => {
    expect(() => withVentaCreateIdempotencyKey(
      { idempotencyKey: ' ', puntoDeVentaId: 'pv-1' }, 'header-key',
    )).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
