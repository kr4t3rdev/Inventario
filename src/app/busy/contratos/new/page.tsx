/**
 * @description Página para crear nuevo contrato - Server Component
 * @module app/busy/contratos/new/page
 */

import { getClientesAction } from '@/features/clientes'
import { getVendorsAction } from '@/features/vendors'
import { ContratoForm } from '@/features/contratos'
import { unwrapActionResponseWithDefault } from '@/lib/server-actions/helpers'
import prisma from '@/lib/prisma'

/**
 * @description Página de nuevo contrato
 * @returns {Promise<JSX.Element>} Página de nuevo contrato
 */
export default async function NewContratoPage() {
  // Obtener datos del servidor
  const [clientesResponse, vendorsResponse, tiposCustom] = await Promise.all([
    getClientesAction(),
    getVendorsAction(),
    prisma.contrato.findMany({
      where: { tenantId: { not: undefined } },
      select: { tipoCustomId: true, nombre: true }
    }).catch(() => [])
  ])

  // Desempaquetar ActionResponses
  const clientes = unwrapActionResponseWithDefault(clientesResponse, [])
  const vendors = unwrapActionResponseWithDefault(vendorsResponse, [])

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <ContratoForm
        initialClientes={clientes}
        initialVendors={vendors}
        initialTiposCustom={tiposCustom}
      />
    </div>
  )
}
