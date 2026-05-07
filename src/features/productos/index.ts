export {
  getProductosHandler,
  createProductoHandler,
  getProductoByIdHandler,
  updateProductoHandler,
  deleteProductoHandler,
  bulkUpdateStockMinimoHandler,
  restockProductoHandler,
  getStockUbicacionHandler,
} from './api/handlers';

export {
  productosApi,
  useGetProductosQuery,
  useSearchProductosQuery,
  useGetProductoQuery,
  useAddProductoMutation,
  useUpdateProductoMutation,
  useUpdateProductoStockMinimoMutation,
  useDeleteProductoMutation,
  useRestockProductoMutation,
  useGetRestockHistoryQuery,
  useBulkUpdateStockMinimoMutation,
} from './api/productosApi';

export type { Producto } from './types';
