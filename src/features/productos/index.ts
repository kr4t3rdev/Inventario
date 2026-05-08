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

export { ProductoForm } from './components/productos-form';
export type { Producto } from './types';
