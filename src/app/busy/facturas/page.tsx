/**
 * @description Página de lista de facturas - Server Component
 * @module app/busy/facturas/page
 */

import { getFacturasAction } from "@/features/facturas"
import { FacturasContent } from "@/features/facturas"
import { BillingHealthCard } from "@/features/facturas/components/billing-health-card"
import { getCurrentUser } from "@/lib/server-actions"


export const metadata = {
  title: "Facturas - FinanceMDM",
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    limit?: string
    estado?: string
    search?: string
  }>
}

/**
 * @description Página principal de facturas
 * @param {PageProps} props - Props de la página
 * @returns {Promise<JSX.Element>} Página de facturas
 */
export default async function FacturasPage(props: PageProps) {
  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page || '1')
  const limit = parseInt(searchParams.limit || '50')

  const [result, user] = await Promise.all([getFacturasAction({
    page,
    limit,
    estado: searchParams.estado,
    search: searchParams.search,
  }), getCurrentUser()])

  const initialData = result.success ? result.data : undefined

  return (
    <div className="space-y-6">
      {user?.role === 'admin' ? <BillingHealthCard userRole="admin" /> : null}
      <FacturasContent initialData={initialData} />
    </div>
  )
}
