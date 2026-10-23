import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { FinancialStatePanel } from '../FinancialStatePanel'

describe('FinancialStatePanel', () => {
  it('muestra el flujo neto del período y el saldo acumulado como conceptos separados', () => {
    const { container } = render(
      <FinancialStatePanel
        monedaPrincipal="CUP"
        flujoNeto={200}
        ingresosTotales={300}
        egresosTotales={100}
        balances={[{ moneda: 'CUP', saldo: 1000, ingresos: 300, egresos: 100 }]}
        flujoNetoAnterior={150}
      />,
    )

    expect(screen.getByText('Flujo Neto del Período')).toBeInTheDocument()
    expect(screen.getByText('Superávit')).toBeInTheDocument()
    expect(screen.getByText('Ingresos Totales')).toBeInTheDocument()
    expect(screen.getByText('Egresos Totales')).toBeInTheDocument()

    // La línea de contexto debe distinguir saldo acumulado del flujo del período
    const saldoLine = screen.getByText(/Saldo actual de cuentas:/)
    expect(saldoLine).toBeInTheDocument()
    expect(saldoLine.textContent).toContain('1000,00')
    expect(saldoLine.textContent).toContain('acumulado histórico')
    // El saldo acumulado NO debe presentarse como flujo del período
    expect(container.textContent).toContain('en moneda principal')
  })

  it('muestra déficit cuando el flujo neto es negativo', () => {
    render(
      <FinancialStatePanel
        monedaPrincipal="CUP"
        flujoNeto={-50}
        ingresosTotales={100}
        egresosTotales={150}
        balances={[{ moneda: 'CUP', saldo: 20, ingresos: 100, egresos: 150 }]}
      />,
    )

    expect(screen.getByText('Déficit')).toBeInTheDocument()
  })
})
