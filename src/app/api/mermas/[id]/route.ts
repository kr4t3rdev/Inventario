import { getMermaByIdHandler, updateMermaHandler, deleteMermaHandler } from '@/features/mermas/api/handlers';

export const GET = getMermaByIdHandler;
export const PATCH = updateMermaHandler;
export const DELETE = deleteMermaHandler;
