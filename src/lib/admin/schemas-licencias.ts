import { z } from 'zod'

export const planSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
  descripcion: z.string().trim().max(500).optional().nullable(),
  precio: z.number().min(0).default(0),
  duracionDias: z.number().int().positive('La duración debe ser mayor a 0'),
  maxUsuarios: z.number().int().positive().default(1),
  maxAlmacenes: z.number().int().positive().default(1),
  maxProductos: z.number().int().positive().default(100),
})

export const updatePlanSchema = planSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Se requiere al menos un campo para actualizar' }
)

export const licenciaSchema = z.object({
  clave: z.string().trim().min(1).optional(),
  usuarioId: z.string().uuid('Usuario inválido'),
  planId: z.string().uuid('Plan inválido'),
  duracionDias: z.number().int().positive().optional(),
})

export const updateLicenciaSchema = z.object({
  activa: z.boolean().optional(),
  expiracion: z.string().datetime().optional(),
  usuarioId: z.string().uuid().optional(),
})

export const generarLicenciasSchema = z.object({
  planId: z.string().uuid('Plan inválido'),
  cantidad: z.number().int().min(1).max(200).default(1),
  duracionDias: z.number().int().positive().optional(),
  idempotencyKey: z.string().optional(),
})

export const licenciaQuerySchema = z.object({
  planId: z.string().uuid().optional(),
  activa: z.enum(['true', 'false']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  sortBy: z.enum(['createdAt', 'expiracion', 'activa']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const planQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().max(100).optional(),
})
