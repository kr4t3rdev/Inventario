'use client'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * @description Skeleton loader para el panel de usuarios del tenant.
 * Muestra una vista previa del layout mientras se cargan los datos.
 * @returns {JSX.Element} Skeletons que imitan la estructura real
 */
export function TenantUsersSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-4 lg:px-6">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-4 lg:px-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="px-4 lg:px-6">
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>

        {/* Table skeleton */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b bg-muted/30 p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-64 rounded-xl" />
          </div>
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border/50 px-6 py-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
