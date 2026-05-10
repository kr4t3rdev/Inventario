// Server Actions (nuevo)
export {
  getMermasAction,
  getMermaByIdAction,
  createMermaAction,
  updateMermaAction,
  deleteMermaAction,
  getMermaStatsAction,
} from './actions';

// RTK Query (legacy)
export {
  mermasApi,
  useGetMermasQuery,
  useGetMermaQuery,
  useGetMermaStatsQuery,
  useAddMermaMutation,
  useUpdateMermaMutation,
  useDeleteMermaMutation,
} from './api/mermasApi';

// Client Components
export { MermasContent } from './components/mermas-content'

export type { Merma, MermaStats } from './types';
