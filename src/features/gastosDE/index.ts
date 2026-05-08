// Server Actions (nuevo)
export { getGastosDEAction, getGastoDEByIdAction, createGastosDEAction, updateGastosDEAction, deleteGastosDEAction } from './actions';

// RTK Query (legacy)
export { gastosDEApi, useGetGastosDEQuery, useGetGastoDEQuery, useAddGastosDEMutation, useUpdateGastosDEMutation, useDeleteGastosDEMutation } from './api/gastosDEApi'
export { gastosConceptosApi, useGetGastoConceptosQuery, useGetGastoConceptoQuery, useAddGastoConceptoMutation, useUpdateGastoConceptoMutation, useDeleteGastoConceptoMutation, useGetGastoElementosQuery, useAddGastoElementoMutation, useUpdateGastoElementoMutation, useDeleteGastoElementoMutation } from './api/gastosConceptosApi'
export { VendorCombobox } from './components/VendorCombobox'
export { GastoConceptoForm } from './components/GastoConceptoForm'
export { GastoElementoForm } from './components/GastoElementoForm'
export { GastoDEForm } from './components/GastoDEForm'
export type { GastosDE, GastoConcepto, GastoElemento } from './types'
