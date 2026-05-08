// Server Actions (nuevo)
export {
  getOfertasAction,
  getOfertaByIdAction,
  createOfertaAction,
  updateOfertaAction,
  deleteOfertaAction,
  facturarOfertaAction,
} from './actions'

// RTK Query (legacy)
export {
  ofertasApi,
  useGetOfertasQuery,
  useGetOfertaQuery,
  useAddOfertaMutation,
  useUpdateOfertaMutation,
  useFacturarOfertaMutation,
  useDeleteOfertaMutation,
} from './api/ofertasApi'

export { OfertasTable } from './components/ofertas-table'
export { OfertaForm } from './components/oferta-form'
export { QuickOfferDialog } from './components/quick-offer-dialog'
export type { Oferta, OfertaItem } from './types'
