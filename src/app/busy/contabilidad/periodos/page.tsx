'use client'

import dynamic from 'next/dynamic'

const PeriodosManager = dynamic(
  () => import('@/components/contabilidad/periodos/PeriodosManager').then(mod => ({ default: mod.PeriodosManager })),
  {
    loading: () => (
      <div className="container mx-auto p-6 space-y-6">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-4 w-96 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    ),
  }
)

/**
 * @description Página principal de períodos contables
 * @returns {JSX.Element} Página de períodos
 */
export default function PeriodosPage() {
  return (
    <div className="container mx-auto p-6">
      <PeriodosManager />
    </div>
  )
}