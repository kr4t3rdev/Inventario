import { sugerirReabastecimientoAction } from '@/features/compras-productos/actions-reabastecimiento';
import { ReabastecimientoPageClient } from './reabastecimiento-page-client';

export const metadata = { title: 'Reabastecimiento - FinanceMDM' };
export const dynamic = 'force-dynamic';

/**
 * @description Página base para sugerencias min/max. La consulta se ejecuta
 * desde el servidor para aplicar el tenant y la feature flag.
 * @returns {Promise<JSX.Element>} Lista de sugerencias.
 */
export default async function ReabastecimientoPage() {
  const result = await sugerirReabastecimientoAction({});
  const suggestions = result.success ? (result.data ?? []) as any[] : [];
  return (
    <ReabastecimientoPageClient
      suggestions={suggestions}
      error={result.success ? null : result.error?.message ?? 'No se pudieron cargar las sugerencias de reabastecimiento.'}
    />
  );
}
