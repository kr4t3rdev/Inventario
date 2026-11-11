import { Proveedor360PageClient } from '@/features/vendors/components/proveedor-360-page-client';

/**
 * @description Página 360 del proveedor.
 * @param {{ params: Promise<{ id: string }> }} props - Parámetros de ruta.
 * @returns {Promise<JSX.Element>} Resumen comercial y financiero del proveedor.
 */
export default async function Proveedor360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Proveedor360PageClient vendorId={id} />;
}
