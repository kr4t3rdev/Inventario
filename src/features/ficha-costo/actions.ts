/**
 * @description Barrel re-export del módulo Ficha de Costo.
 *
 *   Las Server Actions están divididas por dominio en archivos separados
 *   para mantenerlos pequeños y enfocados:
 *     - `actions-ficha.ts`       — ficha consolidada (CPP/composición)
 *     - `actions-historial.ts`   — historial paginado de compras
 *     - `actions-composicion.ts` — desglose materiales+MO+indirectos
 *     - `actions-producto.ts`    — listar productos y editar precioCosto
 *     - `actions-listas.ts`      — precios en listas del producto
 *     - `actions-plantilla.ts`   — plantillas de ficha de costo (CRUD)
 *
 *   Este archivo se conserva por compatibilidad con imports existentes
 *   (`from '../actions'`). Las nuevas features pueden importar directo
 *   del archivo específico para mayor claridad.
 *
 *   Los tipos compartidos viven en `./types` y se reexportan acá.
 */

export { getFichaCostoAction } from './actions-ficha'
export { getHistorialCostosAction } from './actions-historial'
export { getHistorialReconciliadoAction } from './actions-reconciliacion'
export { getComposicionCostoAction } from './actions-composicion'
export { getVentasProductoAction } from './actions-ventas'
export {
  listarProductosParaFichaAction,
  updatePrecioCostoAction,
} from './actions-producto'
export { getListasPreciosProductoAction } from './actions-listas'
export {
  getPlantillasAction,
  getPlantillaActivaAction,
  createPlantillaAction,
  updatePlantillaAction,
  activarPlantillaAction,
  deletePlantillaAction,
  aplicarPrecioSugeridoAction,
} from './actions-plantilla'
export {
  bulkApplyPercentageAction,
  bulkApplyTemplateAction,
} from './actions-bulk'
export {
  getProductosMargenBajoAction,
  verificarMargenBajoAction,
  getDashboardRentabilidadAction,
} from './actions-alertas'
export {
  getSugerenciasPrecioAction,
  aplicarSugerenciaPrecioAction,
} from './actions-sugerencias'
export { getHistorialCambiosPrecioAction } from './actions-historial-cambios'

export type {
  EstadoMargen,
  EstadoVariacion,
  CostSheetEntityType,
  GetFichaCostoInput,
  FichaCostoProducto,
  FichaCostoCalculado,
  FichaCostoComponentes,
  FichaCostoMerma,
  FichaCostoMargen,
  FichaCostoVariacion,
  FichaCostoData,
  ComposicionMaterial,
  ComposicionCostoData,
  GetComposicionCostoInput,
  HistorialCostosItem,
  HistorialCostosPagination,
  HistorialCostosData,
  GetHistorialCostosInput,
  HistorialReconciliadoItem,
  HistorialProveedorResumen,
  EstadoCPP,
  HistorialReconciliadoData,
  GetHistorialReconciliadoInput,
  VentaProductoItem,
  VentasProductoResumen,
  VentasProductoData,
  GetVentasProductoInput,
  ProductoFichaListItem,
  ListarProductosParaFichaInput,
  UpdatePrecioCostoInput,
  UpdatePrecioCostoResult,
  PrecioEnListaResult,
  GetListasPreciosProductoInput,
  PlantillaCosto,
  PlantillaCostoInput,
  UpdatePlantillaInput,
  ActivarPlantillaInput,
  AplicarPrecioSugeridoInput,
  PlantillaActivaResult,
} from './types'
