// Server Actions
export {
  getContratosAction,
  getContratoByIdAction,
  createContratoAction,
  updateContratoAction,
  deleteContratoAction,
  bulkUpdateContratoStatusAction,
  bulkDeleteContratosAction,
} from './actions';

// Utilidades públicas (seguir exportando)
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
export { ConfiguracionContratos } from './components/configuracion-contratos'
export { ContratosContent } from './components/contratos-content'
export { ContratoForm } from './components/contrato-form'
export { ContratoDetailContent } from './components/contrato-detail-content'

export type { Contrato } from './types'
