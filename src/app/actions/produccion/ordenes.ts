'use server'

import { revalidateTag } from 'next/cache'
import * as fetcher from '@/lib/api/produccion/ordenes'
import { handleServerActionError } from '../_helpers/error-handler'
import type { OrdenProduccion, CreateOrdenProduccionPayload, PaginatedResponse, OrdenesPaginationMeta } from '@/app/models/model'

export async function getOrdenesProduccion(params?: { estado?: string; page?: number; limit?: number }): Promise<PaginatedResponse<OrdenProduccion, OrdenesPaginationMeta>> {
  try { return await fetcher.getOrdenesProduccion(params) }
  catch (error) { handleServerActionError(error, 'getOrdenesProduccion') }
}

export async function getOrdenProduccion(ordenProduccionId: string): Promise<OrdenProduccion> {
  try { return await fetcher.getOrdenProduccion(ordenProduccionId) }
  catch (error) { handleServerActionError(error, 'getOrdenProduccion') }
}

export async function createOrdenProduccion(payload: CreateOrdenProduccionPayload): Promise<OrdenProduccion> {
  try {
    const result = await fetcher.createOrdenProduccion(payload)
    revalidateTag('OrdenesProduccion')
    return result
  } catch (error) { handleServerActionError(error, 'createOrdenProduccion') }
}

export async function aprobarOrdenProduccion(data: { ordenProduccionId: string; userId?: string }): Promise<OrdenProduccion> {
  try {
    const result = await fetcher.aprobarOrdenProduccion(data)
    revalidateTag('OrdenesProduccion')
    revalidateTag('Productos')
    revalidateTag('StockUbicacion')
    return result
  } catch (error) { handleServerActionError(error, 'aprobarOrdenProduccion') }
}

export async function completarOrdenProduccion(data: { ordenProduccionId: string; userId?: string; cuentaId?: string; tipoPagoId?: string }): Promise<OrdenProduccion> {
  try {
    const result = await fetcher.completarOrdenProduccion(data)
    revalidateTag('OrdenesProduccion')
    revalidateTag('Productos')
    revalidateTag('StockUbicacion')
    return result
  } catch (error) { handleServerActionError(error, 'completarOrdenProduccion') }
}

export async function cancelarOrdenProduccion(data: { ordenProduccionId: string; userId?: string; observaciones?: string }): Promise<OrdenProduccion> {
  try {
    const result = await fetcher.cancelarOrdenProduccion(data)
    revalidateTag('OrdenesProduccion')
    revalidateTag('Productos')
    revalidateTag('StockUbicacion')
    return result
  } catch (error) { handleServerActionError(error, 'cancelarOrdenProduccion') }
}
