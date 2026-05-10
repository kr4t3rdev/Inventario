/**
 * @description Página de detalle de contrato - Server Component
 * @module app/busy/contratos/[id]/page
 */

import { notFound } from 'next/navigation'
import { getContratoByIdAction } from '@/features/contratos'
import { ContratoDetailContent } from '@/features/contratos'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * @description Página de detalle de contrato
 * @param {PageProps} props - Props de la página
 * @returns {Promise<JSX.Element>} Página de detalle de contrato
 */
export default async function ContratoDetailPage(props: PageProps) {
  const params = await props.params

  // Obtener datos del servidor
  const contrato = await getContratoByIdAction(params.id)

  if (!contrato) {
    notFound()
  }

  return <ContratoDetailContent initialData={contrato} contratoId={params.id} />
}