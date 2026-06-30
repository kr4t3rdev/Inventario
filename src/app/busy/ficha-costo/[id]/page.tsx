import { notFound } from 'next/navigation'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar2 } from '@/components/app-sidebar2'
import { getFichaCostoAction } from '@/features/ficha-costo/actions'
import { FichaCostoDetalle } from '@/features/ficha-costo/components/ficha-costo-detalle'

interface FichaCostoDetallePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ entityType?: string }>
}

/**
 * @description Página server-first que muestra la ficha de costo de un
 *   producto específico, con su precio de costo editable.
 */
export default async function FichaCostoDetallePage({
  params,
  searchParams,
}: FichaCostoDetallePageProps): Promise<React.JSX.Element> {
  const { id } = await params
  const { entityType } = await searchParams
  const normalizedEntityType = entityType === 'SERVICIO' ? 'SERVICIO' : 'PRODUCTO'
  const result = await getFichaCostoAction({
    entityId: id,
    entityType: normalizedEntityType,
  })
  if (!result.success) {
    if (result.error?.code === 'NOT_FOUND') notFound()
    throw new Error(result.error?.message ?? 'Error desconocido')
  }

  return (
    <SidebarProvider>
      <AppSidebar2 variant="floating" />
      <SidebarInset>
        <FichaCostoDetalle data={result.data} />
      </SidebarInset>
    </SidebarProvider>
  )
}

export const metadata = {
  title: 'Ficha de Costo',
}
