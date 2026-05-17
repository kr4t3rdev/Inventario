/**
 * @description Página de creación de nueva categoría (Server Component).
 *   Renderiza CategoryForm como Client Component.
 * @returns {Promise<JSX.Element>} Vista de formulario de nueva categoría.
 */
import { Suspense } from 'react'
import { CategoryForm } from '@/features/categorias/components/category-form'


export const metadata = {
  title: "Nueva Categoría - FinanceTCP",
}

function NuevaCategoriaFallback() {
  return (
    <div className="container mx-auto py-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-muted rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted rounded animate-pulse" />
            <div className="h-4 w-80 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="h-[400px] bg-muted/30 rounded-xl animate-pulse" />
    </div>
  )
}

export default async function NuevaCategoriaPage(): Promise<React.JSX.Element> {
  return (
    <Suspense fallback={<NuevaCategoriaFallback />}>
      <CategoryForm />
    </Suspense>
  )
}
