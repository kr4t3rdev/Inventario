import { withAuthGet } from "@/lib/auth-middleware"
import {
  getDashboardStatsHandler,
  invalidateDashboardCacheHandler,
} from "@/features/dashboard/api/handlers"

export const GET = withAuthGet(getDashboardStatsHandler)
export const DELETE = invalidateDashboardCacheHandler
