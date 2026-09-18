import { describe, expect, it } from 'vitest';

import { resolveSalesAgentAccess } from '@/lib/auth/sales-agent-access';

describe('resolveSalesAgentAccess', () => {
  it('permite al salesAgent activo únicamente su espacio', () => {
    expect(resolveSalesAgentAccess({ role: 'salesAgent', isActive: true }, '/sales-agent/referidos'))
      .toEqual({ allowed: true });
  });

  it.each(['/busy/dashboard', '/admin/usuarios'])('redirige salesAgent fuera de su espacio: %s', (path) => {
    expect(resolveSalesAgentAccess({ role: 'salesAgent', isActive: true }, path))
      .toEqual({ allowed: false, redirectTo: '/sales-agent/referidos' });
  });

  it('bloquea regularUser tenantless y envía onboarding pendiente a espera', () => {
    expect(resolveSalesAgentAccess({ role: 'regularUser', isActive: true }, '/busy/dashboard'))
      .toEqual({ allowed: false, redirectTo: '/login' });
    expect(resolveSalesAgentAccess({
      role: 'salesAgent',
      isActive: false,
      onboardingStatus: 'awaiting_sales_agent_approval',
    }, '/busy/dashboard')).toEqual({ allowed: false, redirectTo: '/onboarding' });
  });

  it('rechaza usuarios de tenant que intentan entrar al namespace salesAgent', () => {
    expect(resolveSalesAgentAccess({
      role: 'regularUser',
      isActive: true,
      tenantId: 'tenant-1',
    }, '/sales-agent/referidos')).toEqual({
      allowed: false,
      redirectTo: '/login',
    });
  });
});
