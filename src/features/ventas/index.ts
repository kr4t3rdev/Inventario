export {
  getVentasHandler,
  createVentaHandler,
  getVentaByIdHandler,
  updateVentaHandler,
  deleteVentaHandler,
  getVentasStatsHandler,
} from './api/handlers';

export { ventasApi, useGetVentasQuery, useGetVentaQuery, useGetVentaStatsQuery, useAddVentaMutation, useUpdateVentaMutation, useDeleteVentaMutation } from './api/ventasApi';

export { VentasTable } from './components/ventas-table';
export { VentaForm } from './components/venta-form';
export { VentaInterface, VentaInvoiceDialog } from './components/pv-interface';
export { ProductoCard } from './components/producto-card';
export { CartItem } from './components/cart-item';
export { EnhancedVentaForm } from './components/enhanced-venta-form';
export { default as VentaInter } from './components/venta-Inter';

export type { Venta, VentaItem, VentaStats, VentaWithDetails, FormaPagoAnticipo, VentaUnicaRequest } from './types';
