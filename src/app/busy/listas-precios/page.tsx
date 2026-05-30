/**
 * @description Página de administración de listas de precios.
 * Server Component que obtiene datos iniciales via Server Actions
 * y delega la UI interactiva a ListasPreciosPageClient.
 *
 * @returns {Promise<JSX.Element>} Vista para gestionar listas de precios.
 */
import { getListasPreciosAction } from "@/features/listas-precios"
import { ListasPreciosPageClient } from "@/features/listas-precios/components/listas-precios-page-client"


export const metadata = {
  title: "Listas de Precios - FinanceMDM",
}

export default async function ListasPreciosPage() {
  const result = await getListasPreciosAction()
  const listas = result.success ? (result.data ?? []) : []

  return <ListasPreciosPageClient listas={listas} />
}
