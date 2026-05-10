/**
 * @description Página para editar contrato - Server Component
 * @module app/busy/contratos/update/[id]/page
 */

import { notFound } from 'next/navigation'
import { getClientesAction } from '@/features/clientes'
import { getVendorsAction } from '@/features/vendors'
import { getContratoByIdAction } from '@/features/contratos'
import { ContratoForm } from '@/features/contratos'
import prisma from '@/lib/prisma'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * @description Página de edición de contrato
 * @param {PageProps} props - Props de la página
 * @returns {Promise<JSX.Element>} Página de edición de contrato
 */
export default async function UpdateContratoPage(props: PageProps): Promise<JSX.Element> {
  const params = await props.params

  // Obtener datos del servidor en paralelo
  const [contrato, clientes, vendors, tiposCustom] = await Promise.all([
    getContratoByIdAction(params.id),
    getClientesAction(),
    getVendorsAction(),
    prisma.tipoContrato.findMany({
      where: { activo: true },
      select: { tipoCustomId: true, nombre: true }
    }).catch(() => [])
  ])

  if (!contrato) {
    notFound()
  }

  // Map contract data to form format
  const initialData = {
    contratoId: contrato.contratoId,
    tipo: contrato.tipo,
    fechaInicio: contrato.fechaInicio,
    fechaFin: contrato.fechaFin,
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
        initialData={initialData}
        initialClientes={clientes}
        initialVendors={vendors}
        initialTiposCustom={tiposCustom}
        isUpdate
      />
    </div>
  )
}