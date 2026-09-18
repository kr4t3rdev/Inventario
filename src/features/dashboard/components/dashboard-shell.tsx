'use client'

import type { ReactNode } from 'react'
import { LayoutDashboard } from 'lucide-react'

import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui/animations'

interface DashboardShellProps {
  children: ReactNode
}

/**
 * @description Shell del Dashboard con animaciones de fondo, header y layout.
 * Componente client que encapsula framer-motion y recibe children server/client.
 * @param {DashboardShellProps} props - Children widgets
 * @returns {JSX.Element} Layout animado del dashboard
 */
export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <PageTransition className="relative min-h-screen min-w-0 w-full">
      <StaggerContainer className="flex flex-1 flex-col">
        <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
          <StaggerItem className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="flex items-center gap-3 px-4 lg:px-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LayoutDashboard aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Dashboard
                </h1>
                <p className="text-muted-foreground text-sm">
                  Resumen de tu negocio
                </p>
              </div>
              <div
                role="status"
                aria-label="Sistema activo"
                className="ml-auto hidden items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
                Sistema Activo
              </div>
            </div>

            {children}
          </StaggerItem>
        </div>
      </StaggerContainer>
    </PageTransition>
  )
}
