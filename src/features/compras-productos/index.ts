// Server Actions (nuevo)
export {
  getComprasProductosAction,
  getCompraProductoByIdAction,
  createCompraProductoAction,
  updateCompraProductoAction,
  deleteCompraProductoAction,
} from './actions';

// RTK Query (legacy)
export { comprasProductosApi, useGetComprasProductosQuery, useCreateCompraProductoMutation, useGetCompraProductoByIdQuery, useUpdateCompraProductoMutation, useDeleteCompraProductoMutation } from './api/comprasProductosApi';
export type { CompraDocumento, CompraDocumentoItem, CompraDocumentoResponse, CompraProducto } from './types';
