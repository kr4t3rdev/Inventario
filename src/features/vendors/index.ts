// Server Actions (nuevo)
export {
  getVendorsAction,
  getVendorByIdAction,
  createVendorAction,
  updateVendorAction,
  deleteVendorAction,
} from './actions';

// RTK Query (legacy)
export { vendorsApi, useGetVendorsQuery, useGetVendorQuery, useAddVendorMutation, useUpdateVendorMutation, useDeleteVendorMutation } from './api/vendorsApi';
export { VendorForm } from './components/vendor-form';
export type { Vendor } from './api/vendorsApi';
