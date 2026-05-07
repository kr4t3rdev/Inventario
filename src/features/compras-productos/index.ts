export { getComprasProductosHandler, createCompraProductoHandler, getCompraProductoByIdHandler, updateCompraProductoHandler, deleteCompraProductoHandler, exportComprasProductosHandler } from './api/handlers';
export { comprasProductosApi, useGetComprasProductosQuery, useCreateCompraProductoMutation, useGetCompraProductoByIdQuery, useUpdateCompraProductoMutation, useDeleteCompraProductoMutation } from './api/comprasProductosApi';
export type { CompraDocumento, CompraDocumentoItem, CompraDocumentoResponse, CompraProducto } from './types';
