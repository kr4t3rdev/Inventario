import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CurrencySummaryTable } from '../CurrencySummaryTable'

describe('CurrencySummaryTable', () => {
  it('etiqueta el saldo como acumulado y calcula el saldo inicial aproximado del período', () => {
    render(
      <CurrencySummaryTable
        monedaPrincipal="CUP"
        data={[
          { moneda: 'CUP', saldoActual: 1000, totalIngresos: 300, totalEgresos: 100 },
        ]}
      />,
    )

    // Encabezados con la semántica corregida
    expect(screen.getByText('Saldo de cuentas (acumulado)')).toBeInTheDocument()
    expect(screen.getByText('Saldo aprox. al inicio')).toBeInTheDocument()
    expect(screen.getByText('Ingresos del período')).toBeInTheDocument()
    expect(screen.getByText('Flujo neto del período')).toBeInTheDocument()

    // saldoInicioAprox = saldoActual (1000) − flujoNeto (300 − 100 = 200) = 800
    expect(screen.getByText('800,00')).toBeInTheDocument()
    expect(screen.getByText('1000,00')).toBeInTheDocument()

    // Nota al pie que separa saldo acumulado vs período
    expect(screen.getByText(/acumulado histórico, no del período/)).toBeInTheDocument()
  })

  it('marca la moneda principal y muestra el flujo neto con formato tabular', () => {
    render(
      <CurrencySummaryTable
        monedaPrincipal="USD"
        data={[
          { moneda: 'USD', saldoActual: 50, totalIngresos: 500, totalEgresos: 600 },
        ]}
      />,
    )

    expect(screen.getByText('Principal')).toBeInTheDocument()
    // Flujo neto negativo: 500 − 600 = −100 → "−100,00" con signo menos unicode
    expect(screen.getByText('-100,00')).toBeInTheDocument()
  })
})
