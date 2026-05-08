// Server Actions (nuevo)
export {
  getListasPreciosAction,
  getListaPrecioByIdAction,
  createListaPrecioAction,
  updateListaPrecioAction,
  deleteListaPrecioAction,
} from './actions';

// RTK Query (legacy)
export { listasPreciosApi, useGetListasPreciosQuery, useAddListaPrecioMutation, useUpdateListaPrecioMutation, useDeleteListaPrecioMutation } from './api/listasPreciosApi';
export type { ListaPrecio, ListaPrecioPayload } from './api/listasPreciosApi';
