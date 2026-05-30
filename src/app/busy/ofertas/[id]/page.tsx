/**
 * @description Página de detalle de oferta (Server Component).
 * @param {{ params: Promise<{ id: string }> }} props - Parámetros de la ruta con el ID de la oferta.
 * @returns {Promise<ReactElement>} Vista server-first del detalle de oferta.
 */
import type { ReactElement } from 'react'
import { getOfertaByIdAction } from '@/features/ofertas'
import { OfertaDetailContent } from '@/features/ofertas/components/oferta-detail-content'


export const metadata = {
  title: "Detalle de Oferta - FinanceMDM",
}

interface OfertaDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OfertaDetailPage({ params }: OfertaDetailPageProps): Promise<ReactElement> {
  const { id } = await params
  const result = await getOfertaByIdAction(id)

  return <OfertaDetailContent initialOferta={result.success ? result.data ?? null : null} />
}
