// Server Actions (nuevo)
export {
  getProductosAction,
  createProductoAction,
  updateProductoAction,
  deleteProductoAction,
  getStockPorUbicacionAction,
  bulkUpdateStockMinimoAction,
  getRestockHistoryAction,
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
  // Pendiente: flujo de pagos complejo
  useRestockProductoMutation,
} from './api/productosApi';

export { ProductoForm } from './components/productos-form';
export type { Producto } from './types';
