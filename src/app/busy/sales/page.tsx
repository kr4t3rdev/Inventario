/**
 * @description Página de lista de ventas - Server Component
 * @module app/busy/sales/page
 */

import Link from "next/link"
import { getVentasAction } from "@/features/ventas/actions"
import { VentasTable } from "@/features/ventas"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, PlusCircle, Sparkles } from "lucide-react"
import { VentasPageClient } from "@/features/ventas/components/ventas-page-client"

/**
 * @description Página principal de ventas
 * @returns {Promise<JSX.Element>} Página de ventas
 */
export default async function VentasPage() {
  // Obtener datos del servidor
  const result = await getVentasAction()
  const ventas = result.success ? result.data ?? [] : []

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <VentasPageClient ventas={ventas} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}