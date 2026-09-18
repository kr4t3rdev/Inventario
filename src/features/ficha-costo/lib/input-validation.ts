import { z } from 'zod'
import { ActionError } from '@/lib/server-actions'

export const MAX_PAGE_SIZE = 100
export const MAX_PRODUCT_IDS = 500

const finitePositiveInt = (name: string, max: number) => z.number().finite().int().min(1).max(max, `${name} excede el máximo permitido`)

export const paginationShape = {
  page: z.number().finite().int().min(1).optional(),
  limit: finitePositiveInt('limit', MAX_PAGE_SIZE).optional(),
}
export const paginationSchema = z.object(paginationShape)

export const dateFiltersShape = {
  fechaDesde: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Fecha inválida').optional(),
  fechaHasta: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Fecha inválida').optional(),
}
export const dateFiltersSchema = z.object(dateFiltersShape).refine((v) => !v.fechaDesde || !v.fechaHasta || new Date(v.fechaDesde) <= new Date(v.fechaHasta), {
  message: 'El rango de fechas es inválido', path: ['fechaHasta'],
})

export function validateInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new ActionError('Parámetros inválidos', 'VALIDATION_ERROR')
  return result.data
}

export const productIdsSchema = z.object({
  productoIds: z.array(z.string().trim().min(1)).min(1).max(MAX_PRODUCT_IDS),
}).transform(({ productoIds }) => ({ productoIds: [...new Set(productoIds)] }))
