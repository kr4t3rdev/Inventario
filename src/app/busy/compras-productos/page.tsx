import { getComprasProductosAction } from '@/features/compras-productos/actions'
import { ComprasProductosContent } from '@/features/compras-productos/components/compras-productos-content'


export const metadata = {
  title: "Compras a Productos - FinanceTCP",
}

export default async function ComprasProductosPage() {
  const result = await getComprasProductosAction({ page: 1, limit: 10 })
  const initialCompras = result.success ? (result.data?.compras ?? []) : []
  const initialPagination = result.success ? (result.data?.pagination ?? null) : null

  return (
    <ComprasProductosContent
      initialCompras={initialCompras as any[]}
      initialPagination={initialPagination as any}
    />
  )
}
