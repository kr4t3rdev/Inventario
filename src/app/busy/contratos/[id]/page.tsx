/**
 * @description Página de detalle de contrato - Server Component
 * @module app/busy/contratos/[id]/page
 */

import { notFound } from 'next/navigation'
import { getContratoByIdAction } from '@/features/contratos'
import { ContratoDetailContent } from '@/features/contratos'
import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { hasPermission } from '@/lib/services/tenant-scope'


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

  // El registro de firma (CTF-3) exige `ventas.contratos.gestionar`, la misma
  // clave que protege la ruta POST /api/contratos/[id]/firmas. La UI resuelve
  // el permiso en el servidor para no ofrecer una acción que el backend
  // rechazaría.
  const user = await getCurrentUser()
  const puedeFirmar = user ? hasPermission(user, 'ventas.contratos.gestionar') : false

  // @ts-expect-error TODO: fix type mismatch between server and client component
  return <ContratoDetailContent initialData={
  contrato} contratoId={params.id
  } puedeFirmar={puedeFirmar} />
}
