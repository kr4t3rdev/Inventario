// Server Actions (nuevo)
export { getFacturasAction, getFacturaByIdAction, updateFacturaAction, deleteFacturaAction } from './actions';
export { facturasApi, useGetFacturasQuery, useGetFacturaQuery, useUpdateFacturaMutation, useDeleteFacturaMutation } from './api/facturasApi';
export type { Factura, TipoDocumento, SerieFacturacion, CuentaPorCobrar, Venta, Cliente } from './types';
