/**
 * @description Página para crear una nueva subcategoría CLAS en modo EAN-13.
 * Server Component que sirve como entry point y delega la UI interactiva
 * a SubcategoriaNewPageClient.
 *
 * @returns {Promise<JSX.Element>} Vista de creación de subcategorías CLAS.
 */
import { SubcategoriaNewPageClient } from "@/features/categorias/components/subcategoria-new-page-client";

export default function NuevaSubcategoriaPage() {
  return <SubcategoriaNewPageClient />;
}
