export {
  getMermasHandler,
  createMermaHandler,
  getMermaByIdHandler,
  updateMermaHandler,
  deleteMermaHandler,
  getMermaStatsHandler,
} from './api/handlers';

export {
  mermasApi,
  useGetMermasQuery,
  useGetMermaQuery,
  useGetMermaStatsQuery,
  useAddMermaMutation,
  useUpdateMermaMutation,
  useDeleteMermaMutation,
} from './api/mermasApi';

export type { Merma, MermaStats } from './types';
