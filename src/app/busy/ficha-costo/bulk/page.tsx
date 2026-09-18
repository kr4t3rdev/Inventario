import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar2 } from '@/components/app-sidebar2'
import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { BulkPriceManager } from '@/features/ficha-costo/components/bulk-price-manager'
import { canAccessFichaCostoBulk } from '@/features/ficha-costo/lib/access'

export const metadata: Metadata = {
  title: 'Actualización Masiva de Precios',
  description: 'Aplicar ajustes porcentuales o plantillas de costos a múltiples productos.',
}

/**
 * @description Página de actualización masiva de precios. Requiere el feature
 *   'ficha-costo-bulk' en el plan del tenant. Muestra todos los productos del
 *   tenant para selección masiva.
 */
export default async function BulkPricePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role === 'admin' && !user.tenantId) redirect('/admin')

  if (!canAccessFichaCostoBulk(user)) {
    redirect('/busy/dashboard')
  }

  // Obtener todos los productos del tenant
  const productos = await prisma.producto.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true },
    orderBy: { nombre: 'asc' },
  })

  const productoIds = productos.map((p) => p.id)

  return (
    <SidebarProvider>
      <AppSidebar2 variant="floating" />
      <SidebarInset>
        <div className="container mx-auto py-4">
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">
              Actualización Masiva de Precios
            </h1>
            <p className="text-muted-foreground">
              Aplique ajustes porcentuales o plantillas de costos a múltiples productos de una sola vez.
            </p>
          </header>

          {productoIds.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">
                No hay productos disponibles para actualización masiva.
              </p>
            </div>
          ) : (
            <BulkPriceManager productoIds={productoIds} />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
