/**
 * @description Página principal de gestión de Servicios (Server Component).
 *
 * Resuelve en el servidor:
 * - Lista de servicios del catálogo
 * - Lista de ventas de servicios para el historial
 *
 * La interactividad (catálogo, carrito, búsqueda, eliminación) se delega a
 * ServiciosContent como Client Component (island).
 */
import { getServiciosAction } from "@/features/servicios/actions"
import { getVentaServiciosAction } from "@/features/venta-servicios/actions"
import { ServiciosContent } from "@/features/servicios"

export default async function ServiciosPage() {
  // ── Resolver datos en paralelo en el servidor ──
  const [serviciosResult, ventaServiciosResult] = await Promise.all([
    getServiciosAction(),
    getVentaServiciosAction(),
  ])

  const initialServicios = serviciosResult.success ? serviciosResult.data ?? [] : []
  const initialVentaServicios = ventaServiciosResult.success ? ventaServiciosResult.data ?? [] : []

  return (
    <ServiciosContent
      initialServicios={initialServicios}
      initialVentaServicios={initialVentaServicios}
    />
  )
}