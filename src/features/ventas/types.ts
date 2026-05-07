import type {
  Venta as PrismaVenta,
  VentaItem as PrismaVentaItem,
  VentaStats as PrismaVentaStats,
  VentaWithDetails as PrismaVentaWithDetails,
  FormaPagoAnticipo as PrismaFormaPagoAnticipo,
} from '@/app/models/model';

export type Venta = PrismaVenta;
export type VentaItem = PrismaVentaItem;
export type VentaStats = PrismaVentaStats;
export type VentaWithDetails = PrismaVentaWithDetails;
export type FormaPagoAnticipo = PrismaFormaPagoAnticipo;

export interface VentaUnicaRequest {
  productos: { productoId: string; cantidad: number }[]
  puntoDeVentaId: string
  descuento?: number
  impuestos?: number
  cargoTransporte?: number
  observaciones?: string
  clienteId?: string
  serieId?: string
  fechaVencimiento?: string | null
  tipoVencimiento?: string
  anticipoCobroId?: string
  formaPagoAnticipo?: FormaPagoAnticipo
  idempotencyKey?: string
}
