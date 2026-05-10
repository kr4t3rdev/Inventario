'use server'

import { revalidateTag } from 'next/cache'
import * as fetcher from '@/lib/api/reparaciones/equipos'
import { handleServerActionError } from '../_helpers/error-handler'
import type { EquipoReparacion } from '@/app/models/model'
import type { PiezaReparacion } from '@/app/models/model'

export async function getEquiposReparacion(): Promise<(EquipoReparacion & { piezas: PiezaReparacion[] })[]> {
  try {
    return await fetcher.getEquiposReparacion()
  } catch (error) {
    handleServerActionError(error, 'getEquiposReparacion')
  }
}

export async function getEquipoReparacion(id: string): Promise<EquipoReparacion & { piezas: PiezaReparacion[] }> {
  try {
    return await fetcher.getEquipoReparacion(id)
  } catch (error) {
    handleServerActionError(error, 'getEquipoReparacion')
  }
}

export async function createEquipoReparacion(data: { nombre: string; descripcion?: string }): Promise<EquipoReparacion> {
  try {
    const result = await fetcher.createEquipoReparacion(data)
    revalidateTag('EquiposReparacion', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'createEquipoReparacion')
  }
}

export async function updateEquipoReparacion(id: string, data: { nombre?: string; descripcion?: string }): Promise<EquipoReparacion> {
  try {
    const result = await fetcher.updateEquipoReparacion(id, data)
    revalidateTag('EquiposReparacion', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'updateEquipoReparacion')
  }
}

export async function deleteEquipoReparacion(id: string): Promise<{ success: boolean; id: string }> {
  try {
    const result = await fetcher.deleteEquipoReparacion(id)
    revalidateTag('EquiposReparacion', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'deleteEquipoReparacion')
  }
}
