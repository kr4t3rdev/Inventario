export {
  getContratosHandler,
  createContratoHandler,
  getContratoByIdHandler,
  updateContratoHandler,
  deleteContratoHandler,
  bulkUpdateContratoStatusHandler,
  bulkDeleteContratosHandler,
  createContratoVersionHandler,
  checkContratoVersionDiffHandler,
  getContratoFirmasHandler,
  createContratoFirmaHandler,
  getContratoArchivosHandler,
  createContratoArchivoHandler,
  getContratoAprobacionesHandler,
  createContratoAprobacionHandler,
  getContratoAlertasHandler,
  createContratoAlertaHandler,
} from './api/handlers'

export {
  generarProximoConsecutivo,
  formatearNumeroContrato,
  generarPrefijo,
  validarFormatoNumeroContrato,
  extraerTipoDelNumero,
} from './lib/numeroContratoGenerator'

export { NewVersionDialog } from './components/new-version-dialog'
export { AddFirmaDialog } from './components/add-firma-dialog'
export { TiposContratosList } from './components/tipos-contratos-list'
export { TiposContratosForm } from './components/tipos-contratos-form'

export type { Contrato } from './types'
