import { describe, expect, it } from 'vitest';

import { validateHashChain } from '../services/hash-chain-integrity';

const rows = [
  { asientoId: 'a1', hash: 'h1', hashAnterior: null, hashVersion: 'canonical-v2', tenantSequence: BigInt(1) },
  { asientoId: 'a2', hash: 'h2', hashAnterior: 'h1', hashVersion: 'canonical-v2', tenantSequence: BigInt(2) },
];

describe('validateHashChain', () => {
  it('accepts one complete contiguous chain independent of input order', () => {
    const result = validateHashChain([...rows].reverse(), (row) => row.hash);

    expect(result).toEqual({ valid: true, ordered: rows, failureId: null });
  });

  it('rejects unclassified or non-contiguous historical rows', () => {
    const result = validateHashChain([
      rows[0], { ...rows[1], tenantSequence: BigInt(3), hashVersion: null },
    ], (row) => row.hash);

    expect(result).toMatchObject({ valid: false, failureId: 'a2' });
  });

  it('rejects forks and disconnected rows instead of selecting by timestamp', () => {
    const fork = validateHashChain([
      ...rows,
      { asientoId: 'a3', hash: 'h3', hashAnterior: 'h1', hashVersion: 'canonical-v2', tenantSequence: BigInt(3) },
    ], (row) => row.hash);
    const disconnected = validateHashChain([
      ...rows,
      { asientoId: 'a4', hash: 'h4', hashAnterior: 'unknown', hashVersion: 'canonical-v2', tenantSequence: BigInt(3) },
    ], (row) => row.hash);

    expect(fork.valid).toBe(false);
    expect(disconnected.valid).toBe(false);
  });
});
