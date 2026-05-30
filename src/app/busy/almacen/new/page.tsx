/**
 * @description Página para crear un nuevo almacén.
 * Server Component que sirve como entry point y delega la UI
 * animada e interactiva a NuevoAlmacenPageClient.
 *
 * @returns {JSX.Element} Vista de creación de almacén.
 */
import { NuevoAlmacenPageClient } from "@/features/almacenes/components/almacen-new-page-client"


export const metadata = {
  title: "Nuevo Almacén - FinanceMDM",
}

export default function NuevoAlmacenPage() {
  return <NuevoAlmacenPageClient />
}
