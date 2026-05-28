// Server Actions
export {
  getMermasAction,
  getMermaByIdAction,
  createMermaAction,
  updateMermaAction,
  deleteMermaAction,
  getMermaStatsAction,
} from './actions';

// Client Components
export { MermasContent } from './components/mermas-content'
export { MermaForm } from './components/merma-form'
export { NuevaMermaContent } from './components/nueva-merma-content'
export { EditarMermaContent } from './components/editar-merma-content'

export type { Merma, MermaStats } from './types';

// RTK Query (legacy - internal, no exportar más)