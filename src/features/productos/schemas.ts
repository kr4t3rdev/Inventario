/**
 * @description Schemas Zod compartidos para validación de productos.
 *
 * Basados en el modelo Prisma Producto y la validación inline de handlers.ts.
 * Se usan tanto en cliente (React Hook Form) como en servidor (Server Actions).
 */
import { z } from 'zod';

/**
 * Schema para creación de producto.
 */
export const productoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200),
  descripcion: z.string().max(500).optional().nullable(),

  precioCosto: z.coerce.number().int('Debe ser un número entero').min(0, 'No puede ser negativo'),
  precioVenta: z.coerce.number().int('Debe ser un número entero').min(0, 'No puede ser negativo'),

  stock: z.coerce.number().int().min(0, 'No puede ser negativo'),
  stockMinimo: z.coerce.number().int().min(0).default(0),

  codigoInterno: z
    .string()
    .regex(/^[0-9]{11}$/, 'Debe tener exactamente 11 dígitos')
    .optional()
    .nullable(),

  proveedorCodigo: z.string().max(100).optional().nullable(),

  categoriaId: z.string().min(1, 'La categoría es requerida'),
  subcategoriaId: z.string().optional().nullable(),

  unidadId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),

  almacenId: z.string().min(1, 'El almacén es requerido'),
  puntoDeVentaId: z.string().optional().nullable(),

  fotos: z.array(z.string()).optional().default([]),
  precios: z
    .array(z.object({ listaPrecioId: z.string(), precio: z.number() }))
    .optional(),
});

/**
 * Schema para actualización de producto.
 * Todos los campos son opcionales excepto id.
 */
export const productoUpdateSchema = z.object({
  id: z.string().min(1, 'El ID del producto es requerido'),

  nombre: z.string().min(1, 'El nombre es requerido').max(200).optional(),
  descripcion: z.string().max(500).optional().nullable(),

  precioCosto: z.coerce.number().int().min(0).optional(),
  precioVenta: z.coerce.number().int().min(0).optional(),

  stock: z.coerce.number().int().min(0).optional(),
  stockMinimo: z.coerce.number().int().min(0).optional(),

  codigoInterno: z
    .string()
    .regex(/^[0-9]{11}$/, 'Debe tener exactamente 11 dígitos')
    .optional()
    .nullable(),

  proveedorCodigo: z.string().max(100).optional().nullable(),

  categoriaId: z.string().min(1).optional(),
  subcategoriaId: z.string().optional().nullable(),

  unidadId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),

  almacenId: z.string().min(1).optional(),
  puntoDeVentaId: z.string().optional().nullable(),

  fotos: z.array(z.string()).optional(),
  precios: z
    .array(z.object({ listaPrecioId: z.string(), precio: z.number() }))
    .optional(),
});

/**
 * Schema para actualización de stock (restock simple).
 */
export const stockUpdateSchema = z.object({
  productoId: z.string().min(1, 'El ID del producto es requerido'),
  cantidad: z.coerce.number().int('Debe ser entero').min(1, 'Debe ser mayor a 0'),
  precioCosto: z.coerce.number().int().min(0).optional(),
});

/**
 * Schema para consulta de stock por ubicación.
 */
export const stockUbicacionQuerySchema = z.object({
  ubicacionId: z.string().min(1, 'El ID de ubicación es requerido'),
  tipoUbicacion: z.enum(['almacen', 'punto_venta'], {
    errorMap: () => ({ message: 'tipoUbicacion debe ser "almacen" o "punto_venta"' }),
  }),
  includeZero: z.boolean().optional().default(true),
});

// ─── Tipos inferidos ──────────────────────────────────────

export type ProductoInput = z.infer<typeof productoSchema>;
export type ProductoUpdateInput = z.infer<typeof productoUpdateSchema>;
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;
export type StockUbicacionQuery = z.infer<typeof stockUbicacionQuerySchema>;
