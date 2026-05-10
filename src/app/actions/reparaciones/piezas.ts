'use server'

import { revalidateTag } from 'next/cache'
import * as fetcher from '@/lib/api/reparaciones/piezas'
import { handleServerActionError } from '../_helpers/error-handler'
import type { PiezaReparacion } from '@/app/models/model'

export async function createPiezaReparacion(data: { nombre: string; equipoId: string; costoPequeno: number; costoMediano: number; costoGrande: number }): Promise<PiezaReparacion> {
  try {
    const result = await fetcher.createPiezaReparacion(data)
    revalidateTag('EquiposReparacion', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'createPiezaReparacion')
  }
}

export async function updatePiezaReparacion(id: string, data: { nombre?: string; costoPequeno?: number; costoMediano?: number; costoGrande?: number }): Promise<PiezaReparacion> {
  try {
    const result = await fetcher.updatePiezaReparacion(id, data)
    revalidateTag('EquiposReparacion', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'updatePiezaReparacion')
  }
}

export async function deletePiezaReparacion(id: string): Promise<{ success: boolean; id: string }> {
  try {
    const result = await fetcher.deletePiezaReparacion(id)
    revalidateTag('EquiposReparacion', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'deletePiezaReparacion')
  }
}
