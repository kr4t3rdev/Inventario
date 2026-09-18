import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/animations', () => ({
  PageTransition: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', props, children),
  StaggerContainer: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', props, children),
  StaggerItem: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', props, children),
}))

vi.mock('recharts', () => ({
  BarChart: ({ children }: React.PropsWithChildren) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => <div data-testid="recharts-tooltip" />,
  Legend: () => <div data-testid="recharts-legend" />,
}))

vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({
    children,
    className,
    config,
  }: React.PropsWithChildren<{
    className?: string
    config: Record<string, { color?: string }>
  }>) => (
    <div
      className={className}
      data-productos-color={config.productos?.color}
      data-stock-color={config.stockTotal?.color}
    >
      {children}
    </div>
  ),
  ChartTooltip: () => <div data-testid="chart-tooltip" />,
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content" />,
  ChartLegend: () => <div data-testid="chart-legend" />,
  ChartLegendContent: () => <div data-testid="chart-legend-content" />,
}))

import { DashboardShell } from '../dashboard-shell'
import { SectionCards } from '../section-cards'
import { StockDistributionChart } from '../stock-distribution-chart'

const dashboardStats = {
  totalIngresos: 10_000,
  totalBeneficio: 2_500,
  valorTotalInventario: 7_500,
  totalProductos: 12,
  ventasDiarias: {
    ventasHoy: 2,
    ingresosHoy: 900,
    ventasAyer: 1,
    ingresosAyer: 600,
    promedioVentasDiarias: 2,
    promedioIngresosDiarios: 700,
    diasConVentas: 20,
    totalDias: 30,
    totalIngresosPeriodo: 21_000,
    totalCantidadPeriodo: 60,
  },
}

describe('presentación del dashboard', () => {
  it('mantiene el encabezado y el estado del sistema sin decoración animada continua', () => {
    const { container } = render(<DashboardShell><p>Contenido</p></DashboardShell>)

    expect(screen.getByRole('heading', { name: 'Dashboard' })).not.toHaveClass('text-transparent')
    expect(screen.getByRole('status', { name: 'Sistema activo' })).toBeInTheDocument()
    expect(container.querySelector('.blur-3xl')).not.toBeInTheDocument()
  })

  it('da prioridad visual a ingresos y evita efectos decorativos en las métricas', () => {
    const { container } = render(<SectionCards dashboardStats={dashboardStats} />)

    const metrics = screen.getByRole('region', { name: 'Indicadores principales' })
    expect(within(metrics).getByText(/10\.000,00/)).toHaveClass('text-3xl')
    expect(container.querySelector('.blur-3xl')).not.toBeInTheDocument()
    expect(container.querySelector('[class*="bg-linear"]')).not.toBeInTheDocument()
  })

  it('ofrece todos los datos de stock en una lista móvil y reserva el gráfico para pantallas amplias', () => {
    const { container } = render(
      <StockDistributionChart
        data={[
          { categoria: 'Bebidas', productos: 4, stockTotal: 120, valorTotal: 500 },
          { categoria: 'Alimentos', productos: 7, stockTotal: 85, valorTotal: 900 },
        ]}
      />,
    )

    const mobileList = screen.getByRole('list', { name: 'Distribución de stock por categoría' })
    expect(within(mobileList).getByText('Bebidas')).toBeInTheDocument()
    expect(within(mobileList).getByText('120 unidades')).toBeInTheDocument()
    expect(within(mobileList).getByText('4 productos')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart').parentElement).toHaveClass('hidden', 'sm:block')
    expect(screen.getByTestId('bar-chart').parentElement).not.toHaveClass('overflow-hidden')
    expect(container.firstElementChild).toHaveClass('min-w-0')
    expect(container.firstElementChild).not.toHaveClass('overflow-hidden')
  })

  it('usa la leyenda y el tooltip del sistema con colores válidos en dark mode', () => {
    const { container } = render(
      <StockDistributionChart
        data={[{ categoria: 'Bebidas', productos: 4, stockTotal: 120, valorTotal: 500 }]}
      />,
    )

    const chartContainer = container.querySelector('[data-stock-color]')
    expect(chartContainer).toHaveAttribute('data-stock-color', 'var(--chart-1)')
    expect(chartContainer).toHaveAttribute('data-productos-color', 'var(--chart-2)')
    expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument()
    expect(screen.getByTestId('chart-legend')).toBeInTheDocument()
    expect(screen.queryByTestId('recharts-tooltip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('recharts-legend')).not.toBeInTheDocument()
  })
})
