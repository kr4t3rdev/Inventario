'use server'

import { revalidateTag } from 'next/cache'
import * as fetcher from '@/lib/api/produccion/recetas'
import { handleServerActionError } from '../_helpers/error-handler'
import type {
  RecetaProduccion, CreateRecetaProduccionPayload, SetIngredientesPayload,
  SetIngredientesResponse, PaginatedResponse,
} from '@/app/models/model'

export async function getRecetasProduccion(params?: { search?: string; productoId?: string; page?: number; limit?: number }): Promise<PaginatedResponse<RecetaProduccion>> {
  try { return await fetcher.getRecetasProduccion(params) }
  catch (error) { handleServerActionError(error, 'getRecetasProduccion') }
}

export async function getRecetaProduccion(recetaId: string): Promise<RecetaProduccion> {
  try { return await fetcher.getRecetaProduccion(recetaId) }
  catch (error) { handleServerActionError(error, 'getRecetaProduccion') }
}

export async function createRecetaProduccion(payload: CreateRecetaProduccionPayload): Promise<RecetaProduccion> {
  try {
    const result = await fetcher.createRecetaProduccion(payload)
    revalidateTag('RecetasProduccion')
    return result
  } catch (error) { handleServerActionError(error, 'createRecetaProduccion') }
}

export async function updateRecetaProduccion(recetaId: string, payload: Partial<CreateRecetaProduccionPayload>): Promise<RecetaProduccion> {
  try {
    const result = await fetcher.updateRecetaProduccion(recetaId, payload)
    revalidateTag('RecetasProduccion')
    return result
  } catch (error) { handleServerActionError(error, 'updateRecetaProduccion') }
}

export async function deleteRecetaProduccion(recetaId: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await fetcher.deleteRecetaProduccion(recetaId)
    revalidateTag('RecetasProduccion')
    return result
  } catch (error) { handleServerActionError(error, 'deleteRecetaProduccion') }
}

export async function setIngredientesRecetaProduccion(payload: SetIngredientesPayload): Promise<SetIngredientesResponse> {
  try {
    const result = await fetcher.setIngredientesRecetaProduccion(payload)
    revalidateTag('RecetasProduccion')
    return result
  } catch (error) { handleServerActionError(error, 'setIngredientesRecetaProduccion') }
}

export async function deleteIngredienteRecetaProduccion(recetaId: string, productoId: string): Promise<RecetaProduccion> {
  try {
    const result = await fetcher.deleteIngredienteRecetaProduccion(recetaId, productoId)
    revalidateTag('RecetasProduccion')
    return result
  } catch (error) { handleServerActionError(error, 'deleteIngredienteRecetaProduccion') }
}
