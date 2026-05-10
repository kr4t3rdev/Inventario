/**
 * @description Página de lista de facturas - Server Component
 * @module app/busy/facturas/page
 */

import { getFacturasAction } from "@/features/facturas"
import { FacturasContent } from "@/features/facturas"

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

  const result = await getFacturasAction({
    page,
    limit,
    estado: searchParams.estado,
    search: searchParams.search,
  })

  const initialData = result.success ? result.data : undefined

  // @ts-expect-error
  return <FacturasContent initialData={
  initialData
  } />
}