// Server Actions
export {
  getRecetasProduccionAction,
  getRecetaProduccionByIdAction,
  createRecetaProduccionAction,
  updateRecetaProduccionAction,
  deleteRecetaProduccionAction,
  setIngredientesRecetaProduccionAction,
  getOrdenesProduccionAction,
  getOrdenProduccionByIdAction,
  createOrdenProduccionAction,
  aprobarOrdenProduccionAction,
  completarOrdenProduccionAction,
  cancelarOrdenProduccionAction,
  planificarNecesidadesAction,
} from './actions'

// Client Components
export { ProduccionContent } from './components/produccion-content'
export { RecipeOutputSelector } from './components/recipe-output-selector'
export { ProductionDialogs } from './components/production-dialogs'
export { RecipeEditorDialog } from './components/recipe-editor-dialog'
export { ProductoSalidaForm } from './components/producto-salida-form'

export type { RecetaProduccion, OrdenProduccion } from './types'
export {
  BomError,
  explodeBom,
  validateBomAcyclic,
} from './services/bom'
export { planificarNecesidades } from './services/mrp'
export type {
  MrpMaterialSuggestion,
  MrpPlan,
  MrpProductionSuggestion,
  MrpStockBalance,
} from './services/mrp'
export type {
  BomExplosion,
  BomIngredient,
  BomMaterialRequirement,
  BomRecipe,
  BomRecipeIngredient,
  BomSubrecipeRequirement,
} from './services/bom'
