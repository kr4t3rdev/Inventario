/**
 * @description Página de lista de contratos - Server Component
 * @module app/busy/contratos/page
 */

import { getContratosAction } from '@/features/contratos'
import { ContratosContent } from '@/features/contratos'
import { unwrapActionResponseWithDefault } from '@/lib/server-actions/helpers'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

interface PageProps {
  searchParams: Promise<{
    page?: string
    limit?: string
    tipo?: string
    estado?: string
    fechaInicio?: string
    fechaFin?: string
  }>
}

/**
 * @description Página principal de contratos
 * @param {PageProps} props - Props de la página
 * @returns {Promise<JSX.Element>} Página de contratos
 */
export default async function ContratosPage(props: PageProps) {
  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page || '1')
  const limit = parseInt(searchParams.limit || '10')

  // Obtener datos iniciales usando Server Action
  const result = await getContratosAction({
    page,
    limit,
    tipo: searchParams.tipo,
    estado: searchParams.estado,
    fechaInicio: searchParams.fechaInicio,
    fechaFin: searchParams.fechaFin,
  })

  // Desempaquetar response
  const initialData = unwrapActionResponseWithDefault(result, { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } })

  // Obtener configuración del sistema
  let configuracion = null
  try {
    configuracion = await prisma.configuracionSistema.findFirst()
  } catch (error) {
    console.error('Error fetching config:', error)
  }

  return (
    <ContratosContent
  // @ts-expect-error
      initialData={initialData.data}
      initialMeta={initialData.meta}
      configuracion={configuracion}
    />
  )
}
