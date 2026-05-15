// Server Actions (nuevo)
export {
  getProductosAction,
  getProductoByIdAction,
  createProductoAction,
  updateProductoAction,
  deleteProductoAction,
  getStockPorUbicacionAction,
  bulkUpdateStockMinimoAction,
  getRestockHistoryAction,
  restockProductoAction,
} from './actions';

// Components
export { ProductoForm } from './components/productos-form';
export type { Producto } from './types';
