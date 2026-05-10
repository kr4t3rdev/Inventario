'use server'

import { revalidateTag } from 'next/cache'
import * as fetcher from '@/lib/api/produccion/vales'
import { handleServerActionError } from '../_helpers/error-handler'
import type { ValeSalida, CreateValeSalidaPayload } from '@/app/models/model'

export async function getConceptos(): Promise<string[]> {
  try { return await fetcher.getConceptos() }
  catch (error) { handleServerActionError(error, 'getConceptos') }
}

export async function getValesSalida(params?: { concepto?: string; estado?: string }): Promise<ValeSalida[]> {
  try { return await fetcher.getValesSalida(params) }
  catch (error) { handleServerActionError(error, 'getValesSalida') }
}

export async function getValeSalida(valeSalidaId: string): Promise<ValeSalida> {
  try { return await fetcher.getValeSalida(valeSalidaId) }
  catch (error) { handleServerActionError(error, 'getValeSalida') }
}

export async function createValeSalida(payload: CreateValeSalidaPayload & { userId?: string }): Promise<ValeSalida> {
  try {
    const result = await fetcher.createValeSalida(payload)
    revalidateTag('ValesSalida', {})
    revalidateTag('Productos', {})
    return result
  } catch (error) { throw handleServerActionError(error, 'createValeSalida') }
}

export async function updateValeSalida(valeSalidaId: string, data: { concepto?: string; observaciones?: string }): Promise<ValeSalida> {
  try {
    const result = await fetcher.updateValeSalida(valeSalidaId, data)
    revalidateTag('ValesSalida', {})
    return result
  } catch (error) { throw handleServerActionError(error, 'updateValeSalida') }
}

export async function anularValeSalida(valeSalidaId: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await fetcher.anularValeSalida(valeSalidaId)
    revalidateTag('ValesSalida', {})
    revalidateTag('Productos', {})
    return result
  } catch (error) { throw handleServerActionError(error, 'anularValeSalida') }
}
