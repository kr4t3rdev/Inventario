import { getVendorByIdHandler, updateVendorHandler, deleteVendorHandler } from '@/features/vendors/api/handlers';

export const GET = getVendorByIdHandler;
export const PATCH = updateVendorHandler;
export const DELETE = deleteVendorHandler;
