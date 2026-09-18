/**
 * @description Página de lista de ofertas - Server Component
 * @module app/busy/ofertas/page
 */

import { getOfertasAction } from "@/features/ofertas"
import { OffersServicesHealthCard } from "@/features/ofertas/components/offers-services-health-card"
import { getCurrentUser } from "@/lib/server-actions"
import { OfertasPageContent } from "./page-client"

/**
 * @description Página principal de ofertas
 * @returns {Promise<JSX.Element>} Página de ofertas
 */

export const metadata = {
  title: "Ofertas - FinanceMDM",
}

export default async function OfertasPage() {
  const [result, user] = await Promise.all([getOfertasAction(), getCurrentUser()])
  const ofertas = result.success ? result.data ?? [] : []

  return (
    <div className="space-y-6">
      {user?.role === 'admin' ? <OffersServicesHealthCard userRole="admin" /> : null}
      <OfertasPageContent ofertas={ofertas} />
    </div>
  )
}
