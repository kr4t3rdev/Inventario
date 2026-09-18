import { describe, expect, it } from 'vitest';

import { buildSalesAgentShareUrl, buildWhatsAppShareUrl } from '../share';

describe('sales-agent sharing', () => {
  it('builds an encoded first-party referral URL', () => {
    expect(buildSalesAgentShareUrl('https://finance.test/', 'SA A/1')).toBe(
      'https://finance.test/register?ref=SA+A%2F1',
    );
  });

  it('keeps editable text and referral URL inside the WhatsApp URL', () => {
    const result = buildWhatsAppShareUrl('Probá Finance MDM', 'https://test/register?ref=SA-1');
    expect(result).toBe(
      `https://wa.me/?text=${encodeURIComponent('Probá Finance MDM https://test/register?ref=SA-1')}`,
    );
  });
});
