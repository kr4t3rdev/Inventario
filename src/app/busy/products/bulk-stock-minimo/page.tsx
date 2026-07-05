/**
 * @description Página de configuración masiva de stock mínimo para productos.
 * Gateada por la feature `productos-stock-masivo` del plan (solo Empresarial).
 * Si el usuario no tiene la feature, redirige a /busy/products.
 *
 * @returns {Promise<JSX.Element>} Vista de actualización masiva o redirect.
 */
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/server-actions'
import { BulkStockMinimoClient } from './bulk-stock-minimo-client'

export default async function BulkStockMinimoPage() {
  const user = await getCurrentUser()

  if (user?.planFeatures?.['productos-stock-masivo'] !== true) {
    redirect('/busy/products')
  }

  return <BulkStockMinimoClient />
}
