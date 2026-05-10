'use server'

import { revalidateTag } from 'next/cache'
import * as fetcher from '@/lib/api/reparaciones/defectaciones'
import { handleServerActionError } from '../_helpers/error-handler'
import type { DefectacionCatalogo } from '@/app/models/model'

export async function getDefectaciones(): Promise<DefectacionCatalogo[]> {
  try {
    return await fetcher.getDefectaciones()
  } catch (error) {
    handleServerActionError(error, 'getDefectaciones')
  }
}

export async function createDefectacion(data: { defecto: string; costo: number }): Promise<DefectacionCatalogo> {
  try {
    const result = await fetcher.createDefectacion(data)
    revalidateTag('Defectaciones', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'createDefectacion')
  }
}

export async function updateDefectacion(id: string, data: { defecto?: string; costo?: number }): Promise<DefectacionCatalogo> {
  try {
    const result = await fetcher.updateDefectacion(id, data)
    revalidateTag('Defectaciones', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'updateDefectacion')
  }
}

export async function deleteDefectacion(id: string): Promise<{ success: boolean; id: string }> {
  try {
    const result = await fetcher.deleteDefectacion(id)
    revalidateTag('Defectaciones', {})
    return result
  } catch (error) {
    handleServerActionError(error, 'deleteDefectacion')
  }
}
