import type { DashboardStats, DashboardStatsQueryFilters } from '@/features/dashboard/queries';
import { getDashboardStatsQuery } from '@/features/dashboard/queries';

import type { CacheEntry } from '@/features/dashboard/api/types';

interface DashboardStatsArgs extends DashboardStatsQueryFilters {
  tenantId: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30 * 1000;

/**
 * @description Invalidates cached dashboard stats.
 * @returns {void} No return value.
 */
export function invalidateDashboardStatsCache(): void {
  const keysToDelete = Array.from(cache.keys()).filter((key) => key.startsWith('dashboard-stats-'));
  keysToDelete.forEach((key) => cache.delete(key));
}

/**
 * @description Returns tenant-scoped dashboard statistics using the shared dashboard query.
 * @param {DashboardStatsArgs} args - Tenant and optional location filters.
 * @returns {Promise<Record<string, unknown>>} Dashboard stats payload.
 */
export async function getDashboardStatsData({
  tenantId,
  ubicacionId,
  tipoUbicacion,
}: DashboardStatsArgs): Promise<DashboardStats> {
  const cacheKey = `dashboard-stats-${tenantId}-${ubicacionId || 'all'}-${tipoUbicacion || 'all'}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as DashboardStats;
  }

  const data = await getDashboardStatsQuery(tenantId, {
    ubicacionId,
    tipoUbicacion,
  });

  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
