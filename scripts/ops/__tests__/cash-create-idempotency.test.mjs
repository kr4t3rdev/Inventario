import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cashCreatePayloadHash,
  isCashCreateIdempotencyUniqueConflict,
  normalizeCashCreateIdempotencyKey,
} from '../../../src/lib/services/cash-create-idempotency.ts';

test('normalizes bounded cash-create idempotency keys', () => {
  assert.equal(normalizeCashCreateIdempotencyKey('  retry-1  '), 'retry-1');
  assert.equal(normalizeCashCreateIdempotencyKey(undefined), null);
  assert.throws(() => normalizeCashCreateIdempotencyKey('   '));
  assert.throws(() => normalizeCashCreateIdempotencyKey('x'.repeat(65)));
});

test('hashes the same canonical create payload independent of property order', () => {
  const first = cashCreatePayloadHash({ clienteId: 'c1', montoCapital: 150, moneda: 'CUP' });
  const same = cashCreatePayloadHash({ moneda: 'CUP', montoCapital: 150, clienteId: 'c1' });
  const different = cashCreatePayloadHash({ clienteId: 'c1', montoCapital: 151, moneda: 'CUP' });
  assert.equal(first, same);
  assert.notEqual(first, different);
});

test('replays before period validation and writes', async () => {
  const trace = [];
  const result = await import('../../../src/lib/services/cash-create-idempotency.ts').then(
    ({ runCashCreateWithReplay }) => runCashCreateWithReplay({
      findReplay: async () => { trace.push('lookup'); return { id: 'existing' }; },
      validatePeriod: async () => { trace.push('validate'); },
      write: async () => { trace.push('write'); return { id: 'new' }; },
      canRecover: () => false,
    }),
  );
  assert.deepEqual(result, { id: 'existing' });
  assert.deepEqual(trace, ['lookup']);
});

test('recovers a period-close race only if the operation committed meanwhile', async () => {
  let lookups = 0;
  const result = await import('../../../src/lib/services/cash-create-idempotency.ts').then(
    ({ runCashCreateWithReplay }) => runCashCreateWithReplay({
      findReplay: async () => (++lookups === 1 ? null : { id: 'committed' }),
      validatePeriod: async () => { throw new Error('PERIODO_CERRADO'); },
      write: async () => ({ id: 'unreachable' }),
      canRecover: (error) => error instanceof Error && error.message === 'PERIODO_CERRADO',
    }),
  );
  assert.deepEqual(result, { id: 'committed' });
  assert.equal(lookups, 2);
});

test('recovers a unique-key race but preserves unrelated write failures', async () => {
  let lookups = 0;
  const result = await import('../../../src/lib/services/cash-create-idempotency.ts').then(
    ({ runCashCreateWithReplay }) => runCashCreateWithReplay({
      findReplay: async () => (++lookups === 1 ? null : { id: 'concurrent' }),
      validatePeriod: async () => {},
      write: async () => { throw Object.assign(new Error('unique'), { code: 'P2002' }); },
      canRecover: (error) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002',
    }),
  );
  assert.deepEqual(result, { id: 'concurrent' });
  assert.equal(lookups, 2);
});


test('recovers only the tenant-scoped idempotency unique-index conflict', () => {
  assert.equal(isCashCreateIdempotencyUniqueConflict({
    code: 'P2002',
    meta: { target: ['tenantId', 'idempotencyKey'] },
  }), true);
  assert.equal(isCashCreateIdempotencyUniqueConflict({
    code: 'P2002',
    meta: { target: ['cuentaPorCobrarId'] },
  }), false);
  assert.equal(isCashCreateIdempotencyUniqueConflict({ code: 'P2003' }), false);
});
