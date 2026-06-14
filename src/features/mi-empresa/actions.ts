/**
 * @description Server Actions para Mi Empresa. Reutilizan el servicio compartido del dominio.
 *
 * @module features/mi-empresa/actions
 */
'use server';

import { withAction } from '@/lib/server-actions';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  getMiEmpresaByTenant,
  upsertMiEmpresa,
} from '@/features/mi-empresa/services/mi-empresa-service';

export const getMiEmpresaAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return getMiEmpresaByTenant(tenantId);
});

export const updateMiEmpresaAction = withAction(
  async (input: unknown, user: AuthenticatedUser) => upsertMiEmpresa({ input, user }),
);
