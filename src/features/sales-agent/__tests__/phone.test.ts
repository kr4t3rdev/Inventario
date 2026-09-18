import { describe, expect, it } from 'vitest';

import { normalizeSalesAgentPhone } from '@/features/sales-agent/phone';

describe('normalizeSalesAgentPhone', () => {
  it('normaliza separadores y conserva el prefijo internacional', () => {
    expect(normalizeSalesAgentPhone('+53 (555) 123-4567')).toBe('+535551234567');
  });

  it.each(['abcdefg', '+53abc1234567', '555-12x-345', '++535551234'])(
    'rechaza letras o basura: %s',
    (phone) => {
      expect(() => normalizeSalesAgentPhone(phone)).toThrow();
    },
  );

  it.each(['123456', '1'.repeat(21)])('rechaza límites inválidos: %s', (phone) => {
    expect(() => normalizeSalesAgentPhone(phone)).toThrow();
  });
});
