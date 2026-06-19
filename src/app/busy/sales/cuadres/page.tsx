import type { Metadata } from 'next';

import { getCuadresCerradosAction } from '@/features/turnos-pos/actions-historial';
import { CuadresHistoryPageClient } from '@/features/turnos-pos/components/cuadres-history-page-client';

export const metadata: Metadata = {
  title: 'Historial de Cuadres POS',
  description: 'Consulta turnos cerrados y abre su cuadre guardado por turno.',
};

/**
 * @description Página server del historial de cuadres cerrados.
 * @returns {Promise<JSX.Element>} Vista principal del historial POS.
 */
export default async function SalesSettlementHistoryPage() {
  const result = await getCuadresCerradosAction({ limit: 50 });
  const items = result.success ? result.data ?? [] : [];

  return <CuadresHistoryPageClient items={items} />;
}
