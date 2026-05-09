import { getProductosAction } from "@/features/productos/actions"
import { getAlmacenesAction } from "@/features/almacenes"
import { getPuntosDeVentaAction } from "@/features/puntos-venta"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/server-actions"
import { ProductosContent } from "@/features/productos/components/productos-content"
import type { Producto } from "@/features/productos/types"

/**
 * @description Página principal de gestión de productos (Server Component).
 *
 * Resuelve en el servidor:
 * - Lista inicial de productos del tenant
 * - Almacenes y puntos de venta disponibles
 * - Configuración de empresa (usaCodigoEan13)
 *
 * La interactividad (filtros, tabla, modales) se delega a ProductosContent
 * como Client Component (island).
 */
export default async function ProductosPage() {
  // ── Resolver datos en paralelo en el servidor ──
  const [productosResult, almacenesResult, puntosVentaResult] = await Promise.all([
    getProductosAction(),
    getAlmacenesAction(),
    getPuntosDeVentaAction(),
  ])

  // ── Configuración de empresa ──
  let usaEan13 = false
  try {
    const user = await getCurrentUser()
    if (user) {
      const empresa = await prisma.miEmpresa.findFirst({
        where: { tenantId: user.tenantId },
        select: { usaCodigoEan13: true },
      })
      usaEan13 = empresa?.usaCodigoEan13 ?? false
    }
  } catch {
    // Si falla la obtención, usaEan13 queda en false
  }

  const initialProductos: Producto[] = productosResult.success ? productosResult.data ?? [] : []
  const initialAlmacenes = almacenesResult.success ? almacenesResult.data ?? [] : []
  const initialPuntosVenta = puntosVentaResult.success ? puntosVentaResult.data ?? [] : []

  return (
    <ProductosContent
      initialProductos={initialProductos}
      initialAlmacenes={initialAlmacenes}
      initialPuntosVenta={initialPuntosVenta}
      usaEan13={usaEan13}
    />
  )
}
