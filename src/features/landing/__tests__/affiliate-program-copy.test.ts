import { describe, expect, it } from 'vitest';

import {
  AFFILIATE_PROGRAM_TIERS,
  SALES_AGENT_PROGRAM_STEPS,
  SALES_AGENT_PROGRAM_TIERS,
} from '@/features/landing/data';

describe('landing referral program copy', () => {
  it('keeps tenant benefits separate from sales-agent commissions', () => {
    expect(AFFILIATE_PROGRAM_TIERS).toEqual([
      { range: '1–10 ventas válidas', commission: '5%', perks: '1 perk' },
      { range: '11–50 ventas válidas', commission: '7%', perks: '2 perks' },
      { range: '51+ ventas válidas', commission: '10%', perks: '3 perks' },
    ]);
    expect(SALES_AGENT_PROGRAM_TIERS).toEqual([
      { range: '1–10 tenants activos', commission: '3%', perks: 'Pago por renovación' },
      { range: '11–31 tenants activos', commission: '5%', perks: 'Pago por renovación' },
      { range: '32+ tenants activos', commission: '7%', perks: 'Pago por renovación' },
    ]);
  });

  it('explains the admin-confirmed recurring payment flow', () => {
    expect(SALES_AGENT_PROGRAM_STEPS.map((step) => step.title)).toEqual([
      'Te registras como Gestor de Ventas',
      'Compartes tu código',
      'Administración confirma el pago',
      'Cobras en CUP',
    ]);
  });
});
