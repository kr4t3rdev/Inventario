/**
 * @description Página de lista de ventas - Server Component
 * @module app/busy/sales/page
 */

import Link from "next/link"
import { getVentasAction } from "@/features/ventas/actions"
import { VentasTable } from "@/features/ventas"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, PlusCircle } from "lucide-react"
import { VentasPageClient } from "@/features/ventas/components/ventas-page-client"
import { SalesHealthCard } from "@/features/ventas/components/sales-health-card"
import { getCurrentUser } from "@/lib/server-actions"

/**
 * @description Página principal de ventas
 * @returns {Promise<JSX.Element>} Página de ventas
 */

export const metadata = {
  title: "Sales - FinanceMDM",
}

export default async function VentasPage() {
  const [result, user] = await Promise.all([getVentasAction(), getCurrentUser()])
  const ventas = result.success ? result.data ?? [] : []

  return (
    <div className="container mx-auto space-y-6 py-4">
      {user?.role === 'admin' ? <SalesHealthCard userRole="admin" /> : null}
      <VentasPageClient ventas={ventas} />
    </div>
  )
}
