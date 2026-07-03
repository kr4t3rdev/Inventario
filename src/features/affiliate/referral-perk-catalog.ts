import type { ReferralPerkCatalogItem } from './types';

export const REFERRAL_PERK_CATALOG: ReferralPerkCatalogItem[] = [
  {
    key: 'referral-priority-support',
    label: 'Priority Support',
    description: 'Atención prioritaria para incidencias y dudas operativas.',
    isActive: true,
    adminOnly: true,
  },
  {
    key: 'referral-extra-export-pack',
    label: 'Extra Export Pack',
    description: 'Exportaciones avanzadas adicionales habilitadas por el programa.',
    isActive: true,
    adminOnly: true,
  },
  {
    key: 'referral-advanced-branding',
    label: 'Advanced Branding',
    description: 'Personalización visual exclusiva del programa de referidos.',
    isActive: true,
    adminOnly: true,
  },
];
