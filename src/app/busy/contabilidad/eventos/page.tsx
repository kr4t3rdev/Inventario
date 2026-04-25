'use client'

import dynamic from 'next/dynamic'

const EventosContablesViewer = dynamic(
  () => import('@/components/contabilidad/periodos/EventosContablesViewer').then(mod => ({ default: mod.EventosContablesViewer })),
  {
    loading: () => (
      <div className="container mx-auto p-6 space-y-4">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    ),
  }
)

/**
 * @description Página del visor de eventos contables (subledger)
 * @returns {JSX.Element} Página de eventos contables
 */
export default function EventosPage() {
  return (
    <div className="container mx-auto p-6">
      <EventosContablesViewer />
    </div>
  )
}