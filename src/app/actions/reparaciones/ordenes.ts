'use server'

import { revalidateTag } from 'next/cache'
import * as fetcher from '@/lib/api/reparaciones/ordenes'
import { handleServerActionError } from '../_helpers/error-handler'
import type { OrdenReparacion } from '@/app/models/model'

export async function getOrdenesReparacion(params?: { estado?: string; search?: string }): Promise<OrdenReparacion[]> {
  try {
    return await fetcher.getOrdenesReparacion(params)
  } catch (error) {
    handleServerActionError(error, 'getOrdenesReparacion')
  }
}

export async function getOrdenReparacion(id: string): Promise<OrdenReparacion> {
  try {
    return await fetcher.getOrdenReparacion(id)
  } catch (error) {
    handleServerActionError(error, 'getOrdenReparacion')
  }
}

export async function addOrdenReparacion(data: Partial<OrdenReparacion> & { equipos?: any[] }): Promise<any> {
  try {
    const result = await fetcher.addOrdenReparacion(data)
    revalidateTag('OrdenesReparacion', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'addOrdenReparacion')
  }
}

export async function updateOrdenReparacion(id: string, data: any): Promise<OrdenReparacion> {
  try {
    const result = await fetcher.updateOrdenReparacion(id, data)
    revalidateTag('OrdenesReparacion', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'updateOrdenReparacion')
  }
}

export async function deleteOrdenReparacion(id: string): Promise<{ success: boolean; id: string }> {
  try {
    const result = await fetcher.deleteOrdenReparacion(id)
    revalidateTag('OrdenesReparacion', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'deleteOrdenReparacion')
  }
}
