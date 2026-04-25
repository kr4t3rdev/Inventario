'use client'

import { useState } from 'react'
import { PeriodosTable } from './PeriodosTable'
import { PeriodoAcciones } from './PeriodoAcciones'
import { PeriodoDetail } from './PeriodoDetail'

/**
 * @description Componente principal para gestión de períodos contables
 * @returns {JSX.Element} Manager de períodos con tabla, acciones y detalle
 */
export function PeriodosManager() {
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string | null>(null)

  if (selectedPeriodoId) {
    return (
      <PeriodoDetail
        periodoId={selectedPeriodoId}
        onBack={() => setSelectedPeriodoId(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Períodos Contables</h2>
        <p className="text-muted-foreground">
          Gestión de aperturas, cierres y transiciones de períodos contables
        </p>
      </div>

      <PeriodoAcciones />

      <PeriodosTable onSelectPeriodo={setSelectedPeriodoId} />
    </div>
  )
}