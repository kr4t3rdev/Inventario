/**
 * @description Página principal de gestión de categorías.
 * Server Component que obtiene datos iniciales via Server Actions
 * y delega la UI interactiva a CategoriaPageClient.
 *
 * La data se refresca automáticamente cuando el cliente llama a
 * router.refresh() después de eliminar una categoría, gracias
 * a revalidatePath() dentro de deleteCategoriaAction.
 *
 * @returns {Promise<JSX.Element>} Vista de gestión de categorías.
 */
import { getCategoriasAction, getCategoriaHierarchyAction } from "@/features/categorias"
import { CategoriaPageClient } from "@/features/categorias/components/categoria-page-client"
import type { Categoria, CategoriaHierarchy } from "@/app/models/model"


export const metadata = {
  title: "Categorías - FinanceMDM",
}

export default async function CategoriaPage() {
  const [catResult, hierResult] = await Promise.all([
    getCategoriasAction(),
    getCategoriaHierarchyAction(),
  ])

  const categorias: Categoria[] = (catResult.success ? (catResult.data ?? []) : []) as unknown as Categoria[]
  const hierarchy: CategoriaHierarchy[] = hierResult.success ? (hierResult.data ?? []) : []

  return (
    <CategoriaPageClient
      categorias={categorias}
      hierarchy={hierarchy}
    />
  )
}
