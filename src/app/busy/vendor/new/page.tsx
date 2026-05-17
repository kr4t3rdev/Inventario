/**
 * @description Página para crear un nuevo proveedor.
 * Server Component que delega la UI a NuevoVendorPageClient.
 *
 * @returns {JSX.Element} Vista de creación de proveedor.
 */
import { NuevoVendorPageClient } from "@/features/vendors/components/vendor-new-page-client"


export const metadata = {
  title: "Nuevo Proveedor - FinanceTCP",
}

export default function NewVendor() {
  return <NuevoVendorPageClient />
}
