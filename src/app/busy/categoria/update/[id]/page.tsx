/**
 * @description Página para editar una categoría existente.
 * Server Component que obtiene los datos de la categoría via Server Action
 * y delega la UI a CategoriaEditPageClient.
 *
 * @param {{ params: Promise<{ id: string }> }} props - Parámetros de la ruta.
 * @returns {Promise<JSX.Element>} Vista de edición de categoría.
 */
import { getCategoriaByIdAction } from "@/features/categorias"
import { CategoriaEditPageClient } from "@/features/categorias/components/categoria-edit-page-client"

export default async function EditarCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getCategoriaByIdAction(id)
  const category = result.success ? (result.data ?? null) : null

  return <CategoriaEditPageClient category={category as any} />
}
