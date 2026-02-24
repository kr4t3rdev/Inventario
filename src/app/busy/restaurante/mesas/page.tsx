import type { JSX } from 'react';
import { MesasBoard } from '@/components/restaurante/mesas-board';

/**
 * @description Página de gestión de mesas del módulo restaurante.
 * @param {Record<string, never>} _props - Sin props para la página.
 * @returns {JSX.Element} Vista de gestión de mesas.
 */
export default function MesasRestaurantePage(
  _props: Record<string, never>
): JSX.Element {
  return <MesasBoard />;
}
