export {
  getOfertasHandler,
  createOfertaHandler,
  getOfertaByIdHandler,
  updateOfertaHandler,
  deleteOfertaHandler,
  facturarOfertaHandler,
  getOfertaPdfHandler,
  getOfertaExcelHandler,
} from './api/handlers'

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
