// Server Actions (nuevo)
export {
  getProductosAction,
  createProductoAction,
  updateProductoAction,
  deleteProductoAction,
  getStockPorUbicacionAction,
} from './actions';

// Handlers legacy (para rutas API existentes)
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
  // Mutations pendientes de migrar a Server Actions
  useRestockProductoMutation,
  useGetRestockHistoryQuery,
  useBulkUpdateStockMinimoMutation,
} from './api/productosApi';

export { ProductoForm } from './components/productos-form';
export type { Producto } from './types';
