import { getProfileHandler, updateProfileHandler } from "@/features/profile/api/handlers";

export const dynamic = 'force-dynamic';

export const GET = getProfileHandler;
export const PUT = updateProfileHandler;
