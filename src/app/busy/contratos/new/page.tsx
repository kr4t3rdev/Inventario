/**
 * @description Página para crear nuevo contrato - Server Component
 * @module app/busy/contratos/new/page
 */

import { getClientesAction } from '@/features/clientes'
import { getVendorsAction } from '@/features/vendors'
import { ContratoForm } from '@/features/contratos'
import prisma from '@/lib/prisma'

/**
 * @description Página de nuevo contrato
 * @returns {Promise<JSX.Element>} Página de nuevo contrato
 */
export default async function NewContratoPage(): Promise<JSX.Element> {
  // Obtener datos del servidor
  const [clientes, vendors, tiposCustom] = await Promise.all([
    getClientesAction(),
    getVendorsAction(),
    prisma.tipoContrato.findMany({
      where: { activo: true },
      select: { tipoCustomId: true, nombre: true }
    }).catch(() => [])
  ])

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