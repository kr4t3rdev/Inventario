/**
 * @description Página de detalle de contrato - Server Component
 * @module app/busy/contratos/[id]/page
 */

import { notFound } from 'next/navigation'
import { getContratoByIdAction } from '@/features/contratos'
import { ContratoDetailContent } from '@/features/contratos'


export const metadata = {
  title: "Detalle de Contrato - FinanceMDM",
}

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

  // Obtener datos del servidor y desempaquetar ActionResponse
  const contratoResponse = await getContratoByIdAction(params.id)
  const contrato = contratoResponse?.success ? contratoResponse.data : null

  if (!contrato) {
    notFound()
  }

  // @ts-expect-error TODO: fix type mismatch between server and client component
  return <ContratoDetailContent initialData={
  contrato} contratoId={params.id
  } />
}