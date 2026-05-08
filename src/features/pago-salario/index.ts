export {
  pagoSalarioApi,
  useGetPagoSalariosQuery,
  useGetPagoSalarioQuery,
  useAddPagoSalarioMutation,
  useUpdatePagoSalarioMutation,
  useDeletePagoSalarioMutation,
} from './api/pagoSalarioApi';

export type { Pagosalario } from './types';
export type { PagoSalarioCartItem, PagoSalarioState } from './api/pagoSalarioSlice';
export {
  addToCart,
  removeFromCart,
  clearCart,
  openDialog,
  closeDialog,
  updateCartItem,
  selectPagoSalarioState,
  selectCart,
  selectCartTotal,
  selectIsDialogOpen,
  selectSelectedEmpleado,
} from './api/pagoSalarioSlice';
