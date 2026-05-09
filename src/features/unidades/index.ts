// Server Actions (nuevo)
export {
  getUnidadesAction,
  getUnidadByIdAction,
  createUnidadAction,
  updateUnidadAction,
  deleteUnidadAction,
} from './actions';

// RTK Query (legacy)
export type { Unidad } from './api/unidadesApi';
export { unidadesApi, useGetUnidadesQuery, useGetUnidadQuery, useAddUnidadMutation, useUpdateUnidadMutation, useDeleteUnidadMutation } from './api/unidadesApi';
