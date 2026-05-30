/**
 * @description Página de lista de ofertas - Server Component
 * @module app/busy/ofertas/page
 */

import { getOfertasAction } from "@/features/ofertas"
import { OfertasPageContent } from "./page-client"

/**
 * @description Página principal de ofertas
 * @returns {Promise<JSX.Element>} Página de ofertas
 */

export const metadata = {
  title: "Ofertas - FinanceMDM",
}

export default async function OfertasPage() {
  const result = await getOfertasAction()
  const ofertas = result.success ? result.data ?? [] : []

  return <OfertasPageContent ofertas={ofertas} />
}
