import { getWandaDashboardHandler, invalidateWandaCacheHandler } from "@/features/dashboard/api/handlers"

export const GET = getWandaDashboardHandler
export const DELETE = invalidateWandaCacheHandler
