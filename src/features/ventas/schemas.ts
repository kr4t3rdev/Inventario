/**
 * @description Schemas Zod compartidos para validación de ventas.
 */
import { z } from 'zod';
import { MetodoPagoVenta } from '@/generated/prisma';

/** Schema para una línea de venta */
export const ventaItemSchema = z.object({
  productoId: z.string().min(1, 'El producto es requerido'),
  cantidad: z.coerce.number().int('Debe ser entero').positive('Debe ser mayor a 0'),
  precioUnitario: z.coerce.number().int().min(0, 'No puede ser negativo'),
});

/** Schema para crear una venta */
export const createVentaSchema = z.object({
  puntoDeVentaId: z.string().min(1, 'El punto de venta es requerido'),
  clienteId: z.string().optional().nullable(),
  empleadoId: z.string().optional().nullable(),
  descuento: z.coerce.number().int().min(0).optional().default(0),
  observaciones: z.string().max(500).optional().nullable(),
  items: z.array(ventaItemSchema).min(1, 'Debe tener al menos un producto'),
  // Turno de punto de venta
  turnoId: z.string().optional().nullable(),
  // Método de pago
  metodoPago: z.nativeEnum(MetodoPagoVenta).optional().nullable(),
  montoEfectivo: z.coerce.number().int().min(0).optional().nullable(),
  montoTarjeta: z.coerce.number().int().min(0).optional().nullable(),
  montoTransferencia: z.coerce.number().int().min(0).optional().nullable(),
  montoCredito: z.coerce.number().int().min(0).optional().nullable(),
  // Parámetros de facturación y cobro
  tipoVencimiento: z.enum(['contra_pago', 'fecha', 'plazo']).optional().nullable(),
  fechaVencimiento: z.string().optional().nullable(),
  cuentaBancariaId: z.string().optional().nullable(),
}).refine(
  (data) => {
    // Si es MIXTO, la suma de los montos desglosados debe ser igual al total
    if (data.metodoPago === 'MIXTO') {
      const totalItems = data.items.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);
      const totalVenta = totalItems - (data.descuento ?? 0);
      const sumaMontos = (data.montoEfectivo ?? 0)
        + (data.montoTarjeta ?? 0)
        + (data.montoTransferencia ?? 0)
        + (data.montoCredito ?? 0);
      return sumaMontos === totalVenta;
    }
    return true;
  },
  {
    message: 'La suma de los montos desglosados debe ser igual al total de la venta',
    path: ['montoEfectivo'],
  },
);

/** Schema para anular una venta */
export const anularVentaSchema = z.object({
  ventaId: z.string().min(1, 'El ID de la venta es requerido'),
  motivo: z.string().max(500).optional().nullable(),
});

// ─── Tipos inferidos ──────────────────────────────────────

export type CreateVentaInput = z.infer<typeof createVentaSchema>;
export type VentaItemInput = z.infer<typeof ventaItemSchema>;
export type AnularVentaInput = z.infer<typeof anularVentaSchema>;
