/**
 * @description Server Actions para Mi Empresa. Reemplazan los fetch("/api/mi-empresa") en client components.
 *
 * @module features/mi-empresa/actions
 */
'use server';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Obtiene la configuración de Mi Empresa para el tenant actual.
 * Reemplaza GET /api/mi-empresa.
 *
 * @returns Datos de Mi Empresa o null si no existe
 */
export const getMiEmpresaAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  const miEmpresa = await prisma.miEmpresa.findUnique({
    where: { tenantId },
    select: {
      nombre: true,
      propietario: true,
      direccion: true,
      telefono: true,
      email: true,
      carnetIdentidad: true,
      nit: true,
      licenciaOperacion: true,
      logoUrl: true,
      cuentaBancariaId: true,
      usaCodigoEan13: true,
    },
  });

  return miEmpresa;
});
