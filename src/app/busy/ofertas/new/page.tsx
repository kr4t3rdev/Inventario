/**
 * @description Página para crear nueva oferta - Server Component
 * @module app/busy/ofertas/new/page
 */

import { getClientesAction } from "@/features/clientes"
import { NewOfertaPageContent } from "./page-client"

/**
 * @description Página de nueva oferta
 * @returns {Promise<JSX.Element>} Página de nueva oferta
 */

export const metadata = {
  title: "Nueva Oferta - FinanceMDM",
}

export default async function NewOfertaPage() {
  const clientes = await getClientesAction()

  return <NewOfertaPageContent initialClientes={clientes} />
}
