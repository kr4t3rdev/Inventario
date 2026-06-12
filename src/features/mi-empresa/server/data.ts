/**
 * @description Data fetcher para la página de Mi Empresa.
 * Se ejecuta en el servidor (Server Component) para obtener los datos
 * iniciales sin depender de fetching del lado del cliente.
 *
 * @module features/mi-empresa/server/data
 */

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import type { MiEmpresaApiResponse, CuentaBancariaItem } from '../lib/miEmpresaUtils'

export interface MiEmpresaPageData {
  miEmpresa: MiEmpresaApiResponse | null
  cuentas: CuentaBancariaItem[]
}

/**
 * @description Obtiene los datos iniciales de Mi Empresa y las cuentas bancarias
 * del tenant del usuario autenticado.
 *
 * Usa `getCurrentUser()` que lee el token JWT desde la cookie `auth_token`,
 * exactamente la misma cookie que se setea durante el login.
 *
 * Si no existe un registro de MiEmpresa, genera los datos por defecto usando
 * el nombre del Tenant (definido en el diálogo de aprobación del admin) en
 * lugar del genérico "Mi Empresa".
 *
 * @returns {Promise<MiEmpresaPageData>} Datos de la empresa y lista de cuentas
 */
export async function getMiEmpresaPageData(): Promise<MiEmpresaPageData> {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return { miEmpresa: null, cuentas: [] }
  }

  const tenantId = user.tenantId

  // Fetch en paralelo: empresa + cuentas bancarias + tenant (para el nombre)
  const [miEmpresa, cuentas, tenant] = await Promise.all([
    prisma.miEmpresa.findUnique({
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
    }),

    prisma.cuentaBancaria.findMany({
      where: { tenantId },
      select: {
        cuentaId: true,
        nombreBanco: true,
        numeroCuenta: true,
        moneda: true,
        tipoCuenta: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.tenant.findUnique({
      where: { tenantId },
      select: { nombre: true },
    }),
  ])

  const tenantNombre = tenant?.nombre ?? null

  return {
    miEmpresa: miEmpresa
      ? {
          nombre: miEmpresa.nombre,
          propietario: miEmpresa.propietario,
          direccion: miEmpresa.direccion,
          telefono: miEmpresa.telefono,
          email: miEmpresa.email,
          carnetIdentidad: miEmpresa.carnetIdentidad,
          nit: miEmpresa.nit,
          licenciaOperacion: miEmpresa.licenciaOperacion,
          logoUrl: miEmpresa.logoUrl,
          cuentaBancariaId: miEmpresa.cuentaBancariaId,
          usaCodigoEan13: miEmpresa.usaCodigoEan13,
        }
      : // Si no existe MiEmpresa, crear un objeto por defecto con el nombre del Tenant
        tenantNombre
        ? {
            nombre: tenantNombre,
            propietario: null,
            direccion: null,
            telefono: null,
            email: null,
            carnetIdentidad: null,
            nit: null,
            licenciaOperacion: null,
            logoUrl: null,
            cuentaBancariaId: null,
            usaCodigoEan13: false,
          }
        : null,
    cuentas: cuentas.map((c) => ({
      cuentaId: c.cuentaId,
      nombreBanco: c.nombreBanco,
      numeroCuenta: c.numeroCuenta,
      moneda: c.moneda,
      tipoCuenta: c.tipoCuenta,
      isActive: c.isActive,
    })),
  }
}
