import { getComprasProductosAction } from '@/features/compras-productos/actions'
import { ComprasProductosContent } from '@/features/compras-productos/components/compras-productos-content'
import { PurchaseHealthCard } from '@/features/compras-productos/components/purchase-health-card'
import { getCurrentUser } from '@/lib/server-actions'
import Link from 'next/link'
import { Button } from '@/components/ui/button'


export const metadata = {
  title: "Compras a Productos - FinanceMDM",
}

export default async function ComprasProductosPage() {
  const [result, user] = await Promise.all([
    getComprasProductosAction({ page: 1, limit: 10 }),
    getCurrentUser(),
  ])
  const initialCompras = result.success ? (result.data?.compras ?? []) : []
  const initialPagination = result.success ? (result.data?.pagination ?? null) : null

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/busy/compras-productos/devoluciones">Devoluciones a proveedores</Link>
        </Button>
      </div>
      {user?.role === 'admin' ? <PurchaseHealthCard userRole="admin" /> : null}
      <ComprasProductosContent
        initialCompras={initialCompras as any[]}
        initialPagination={initialPagination as any}
      />
    </div>
  )
}
