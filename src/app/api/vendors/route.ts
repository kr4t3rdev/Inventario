import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getVendorsHandler, createVendorHandler } from '@/features/vendors/api/handlers';

export const GET = withAuthGet(getVendorsHandler);
export const POST = withAuthPost(createVendorHandler);
