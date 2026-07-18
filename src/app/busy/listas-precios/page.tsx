import { getListasPreciosAction } from '@/features/listas-precios';
import { ListasPreciosPageClient } from '@/features/listas-precios/components/listas-precios-page-client';

export const metadata = { title: 'Listas de Precios - FinanceMDM' };

/**
 * @description Obtiene las listas del tenant y conserva los errores de carga para la UI.
 * @returns {Promise<JSX.Element>} Workspace de listas de precios.
 */
export default async function ListasPreciosPage(): Promise<JSX.Element> {
  const result = await getListasPreciosAction();
  return (
    <ListasPreciosPageClient
      listas={result.success ? result.data : []}
      initialError={result.success ? undefined : result.error.message}
    />
  );
}
