/**
 * @description Página para editar contrato - Server Component
 * @module app/busy/contratos/update/[id]/page
 */

import { notFound } from 'next/navigation'
import { getClientesAction } from '@/features/clientes'
import { getVendorsAction } from '@/features/vendors'
import { getContratoByIdAction } from '@/features/contratos'
import { ContratoForm } from '@/features/contratos'
import { unwrapActionResponseWithDefault } from '@/lib/server-actions/helpers'
import prisma from '@/lib/prisma'


export const metadata = {
  title: "Editar Contrato - FinanceMDM",
}

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * @description Página de edición de contrato
 * @param {PageProps} props - Props de la página
 * @returns {Promise<JSX.Element>} Página de edición de contrato
 */
export default async function UpdateContratoPage(props: PageProps) {
  const params = await props.params

  // Obtener datos del servidor en paralelo
  const [contratoResponse, clientesResponse, vendorsResponse, tiposCustom] = await Promise.all([
    getContratoByIdAction(params.id),
    getClientesAction(),
    getVendorsAction(),
    prisma.contrato.findMany({
      where: { tenantId: { not: undefined } },
      select: {
  // @ts-expect-error TODO: fix prisma select type inference
      tipoCustomId: true, nombre: true
      }
    }).catch(() => [])
  ])

  // Desempaquetar ActionResponses
  const contrato = contratoResponse?.success ? contratoResponse.data : null
  const clientes = unwrapActionResponseWithDefault(clientesResponse, [])
  const vendors = unwrapActionResponseWithDefault(vendorsResponse, [])

  if (!contrato) {
    notFound()
  }

  // Map contract data to form format — convertir Date a string ISO
  const initialData = {
    contratoId: contrato.contratoId,
    tipo: contrato.tipo,
    fechaInicio: contrato.fechaInicio instanceof Date ? contrato.fechaInicio.toISOString() : contrato.fechaInicio,
    fechaFin: contrato.fechaFin instanceof Date ? contrato.fechaFin.toISOString() : contrato.fechaFin,
    monto: contrato.monto,
    moneda: contrato.moneda,
    esMultiMoneda: contrato.esMultiMoneda,
    clienteId: contrato.cliente?.clienteId || null,
    vendorId: contrato.vendor?.vendorId || null,
    numeroContratoClienteProveedor: (contrato as any).numeroContratoClienteProveedor || null,
    observaciones: contrato.observaciones,
    condiciones: contrato.condiciones,
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <ContratoForm
  // @ts-expect-error TODO: fix type cast for initialData
        initialData={
        initialData
        }
  // @ts-expect-error TODO: fix type cast for clientes array
        initialClientes={
        clientes
        }
        initialVendors={vendors}
  // @ts-expect-error TODO: fix type cast for tiposCustom array
        initialTiposCustom={
        tiposCustom
        }
        isUpdate
      />
    </div>
  )
}
