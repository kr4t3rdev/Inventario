import { z } from 'zod';

const ordenCompraItemSchema = z.object({
  productoId: z.string().min(1, 'Seleccione un producto'),
  cantidadPedida: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.coerce.number().int().nonnegative('El precio no puede ser negativo'),
});

export const createOrdenCompraSchema = z.object({
  proveedorId: z.string().min(1, 'Seleccione un proveedor'),
  items: z.array(ordenCompraItemSchema).min(1, 'La orden debe incluir al menos un producto'),
});

const recepcionItemSchema = z.object({
  ordenItemId: z.string().min(1),
  cantidad: z.coerce.number().int().positive('La cantidad recibida debe ser mayor a 0'),
});

export const registrarRecepcionSchema = z.object({
  ordenId: z.string().min(1),
  claveIdempotencia: z.string().min(8).max(128).optional(),
  items: z.array(recepcionItemSchema).min(1, 'La recepción debe incluir al menos una línea'),
}).superRefine((value, context) => {
  const ids = value.items.map((item) => item.ordenItemId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['items'],
      message: 'No repita la misma línea en una recepción',
    });
  }
});

export type CreateOrdenCompraInput = z.infer<typeof createOrdenCompraSchema>;
export type RegistrarRecepcionInput = z.infer<typeof registrarRecepcionSchema>;
