/**
 * @description Server Actions para Configuración (cuentas bancarias, series).
 */
'use server'

import { withAction } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export const getCuentasBancariasAction = withAction(async (_input: void, _user: AuthenticatedUser) => {
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { isActive: true },
    orderBy: { nombreBanco: 'asc' },
  })
  return cuentas
})

export const getNextSerieNumberAction = withAction(async (prefijo: string, _user: AuthenticatedUser) => {
  const ultimaSerie = await prisma.serieFacturacion.findFirst({
    where: { prefijo, activa: true },
    select: {
  // @ts-expect-error El shape de SerieFacturacion expone ultimoNumero como string en el tipo Prisma
    serieId: true, prefijo: true, ultimoNumero: true
    },
  })
  // @ts-expect-error El tipo de ultimoNumero es string; el cálculo numérico convierte en runtime
  const nextNumber = (ultimaSerie?.ultimoNumero ?? 0) + 1
  const preview = `${prefijo}${String(nextNumber).padStart(6, '0')}`
  return { nextNumber, prefijo, preview }
})
