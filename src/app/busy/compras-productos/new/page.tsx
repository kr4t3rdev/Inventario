/**
 * @description Página para registrar compras de productos con stock inicial.
 * Server Component que delega la UI a CompraProductoForm.
 * @returns {JSX.Element} Vista de creación de compra.
 */
import { Suspense } from 'react'
import { CompraProductoForm } from '@/features/compras-productos/components/compra-producto-form'


export const metadata = {
  title: "Nueva Compra - FinanceTCP",
}

function NuevaCompraFallback() {
  return (
    <div className="container mx-auto py-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-muted rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted rounded animate-pulse" />
            <div className="h-4 w-80 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="h-[400px] bg-muted/30 rounded-xl animate-pulse" />
    </div>
  )
}

export default function NuevaCompraProductoPage() {
  return (
    <Suspense fallback={<NuevaCompraFallback />}>
      <CompraProductoForm />
    </Suspense>
  )
}
