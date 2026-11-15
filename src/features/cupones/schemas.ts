/**
 * @description Esquemas de validación Zod para el módulo de Cupones.
 *
 * @module features/cupones/schemas
 */
import { z } from 'zod';

export const cuponSchema = z.object({
  codigo: z.string().min(2, 'El código debe tener al menos 2 caracteres'),
  tipo: z.enum(['PORCENTAJE', 'FIJO', '2X1', 'ENVIO_GRATIS', 'PRODUCTO_GRATIS', 'CASHBACK_PUNTOS']),
  valor: z.number().positive('El valor debe ser positivo'),
  descripcion: z.string().optional().nullable(),
  usoMinimo: z.number().int().positive().optional().nullable(),
  usoMaximo: z.number().int().positive().optional().nullable(),
  vecesMaximo: z.number().int().positive().optional().nullable(),
  vecesPorCliente: z.number().int().positive().optional().nullable(),
  validoDesde: z.coerce.date(),
  validoHasta: z.coerce.date().optional().nullable(),
  activo: z.boolean().optional(),
  aplicableA: z.enum(['TODOS', 'CATEGORIA', 'PRODUCTO', 'SEGMENTO']).optional().nullable(),
  filtros: z.record(z.string(), z.any()).optional().nullable(),
  canalAplicacion: z.enum(['POS', 'WEB', 'APP', 'TODOS']).optional().nullable(),
  segmentoTarget: z.string().optional().nullable(),
});

export type CuponInput = z.infer<typeof cuponSchema>;

export const cuponUpdateSchema = z.object({
  cuponId: z.string().min(1),
  codigo: z.string().min(2).optional(),
  tipo: z.enum(['PORCENTAJE', 'FIJO', '2X1', 'ENVIO_GRATIS', 'PRODUCTO_GRATIS', 'CASHBACK_PUNTOS']).optional(),
  valor: z.number().positive().optional(),
  descripcion: z.string().optional().nullable(),
  usoMinimo: z.number().int().positive().optional().nullable(),
  usoMaximo: z.number().int().positive().optional().nullable(),
  vecesMaximo: z.number().int().positive().optional().nullable(),
  vecesPorCliente: z.number().int().positive().optional().nullable(),
  validoDesde: z.coerce.date().optional(),
  validoHasta: z.coerce.date().optional().nullable(),
  activo: z.boolean().optional(),
  aplicableA: z.enum(['TODOS', 'CATEGORIA', 'PRODUCTO', 'SEGMENTO']).optional().nullable(),
  filtros: z.record(z.string(), z.any()).optional().nullable(),
  canalAplicacion: z.enum(['POS', 'WEB', 'APP', 'TODOS']).optional().nullable(),
  segmentoTarget: z.string().optional().nullable(),
});

export type CuponUpdateInput = z.infer<typeof cuponUpdateSchema>;

export const aplicarCuponSchema = z.object({
  codigo: z.string().min(1, 'El código del cupón es obligatorio'),
  clienteId: z.string().optional().nullable(),
  ventaId: z.string().min(1),
  canal: z.enum(['POS', 'WEB', 'APP']),
  totalCompra: z.number().int().positive('El total debe ser positivo'),
  productoIds: z.array(z.string()).optional(),
});

export type AplicarCuponInput = z.infer<typeof aplicarCuponSchema>;
