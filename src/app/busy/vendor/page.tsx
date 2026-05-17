/**
 * @description Página principal de gestión de proveedores.
 * Server Component que obtiene datos iniciales via Server Actions
 * y delega la UI interactiva a VendorPageClient.
 *
 * @returns {Promise<JSX.Element>} Vista de gestión de proveedores.
 */
import { getVendorsAction } from "@/features/vendors"
import { VendorPageClient } from "@/features/vendors/components/vendor-page-client"


export const metadata = {
  title: "Proveedores - FinanceTCP",
}

export default async function VendorPage() {
  const result = await getVendorsAction()
  const vendors = result.success ? (result.data ?? []) : []

  return <VendorPageClient vendors={vendors} />
}
