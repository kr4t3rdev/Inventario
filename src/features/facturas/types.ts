import type { Factura as PrismaFactura, TipoDocumento as PrismaTipoDocumento, SerieFacturacion as PrismaSerieFacturacion, CuentaPorCobrar as PrismaCuentaPorCobrar, Venta as PrismaVenta, Cliente as PrismaCliente } from '@/app/models/model';

export type Factura = PrismaFactura;
export type TipoDocumento = PrismaTipoDocumento;
export type SerieFacturacion = PrismaSerieFacturacion;
export type CuentaPorCobrar = PrismaCuentaPorCobrar;
export type Venta = PrismaVenta;
export type Cliente = PrismaCliente;

/**
 * @description FacturaRow extends Prisma Factura with UI-computed fields.
 * Used for table display where row.original needs facturaId (alias for idFactura),
 * moneda (currency code), and pdfUrl (computed download URL).
 */
export interface FacturaRow extends Factura {
  facturaId: string
  moneda?: string
  pdfUrl?: string
}
