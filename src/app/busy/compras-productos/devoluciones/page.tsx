import type { JSX } from 'react';
import { DevolucionesCompraPage } from '@/features/compras-productos/components/devoluciones-compra-page';
import { getDevolucionesCompraDataAction } from '@/features/compras-productos/devoluciones';

/**
 * @description Presenta el historial y el registro de devoluciones a proveedores.
 * @returns {Promise<JSX.Element>} Página de gestión de devoluciones.
 */
export default async function DevolucionesCompraRoute(): Promise<JSX.Element> {
  const result = await getDevolucionesCompraDataAction();
  const data = result.success ? result.data : { devoluciones: [], compras: [] };
  return <DevolucionesCompraPage
    devoluciones={data?.devoluciones ?? []}
    compras={data?.compras ?? []}
  />;
}
