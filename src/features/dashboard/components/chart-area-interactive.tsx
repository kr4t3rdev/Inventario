'use client'

import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

interface DatosPorMes {
  mes: string
  ingresosVentas: number
  ingresosServicios: number
  gastosMermas: number
  gastosDeExplotacion: number
  gastosDeExplotacionCantidad: number
  gastosCompras: number
  gastosComprasCantidad: number
  gastosSalarios: number
  gastosSalariosCantidad: number
  ventasCantidad: number
  ventasServiciosCantidad: number
  mermasCantidad: number
}

interface ChartDataPoint {
  periodo: string
  ingresos: number
  gastos: number
  beneficio: number
}

interface ChartAreaInteractiveProps {
  data: DatosPorMes[]
}

const yAxisTickCompactFormatter = new Intl.NumberFormat('es', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const chartConfig = {
  ingresos: {
    label: 'Ingresos',
    theme: {
      light: '#16a34a',
      dark: '#22c55e',
    },
  },
  gastos: {
    label: 'Gastos',
    theme: {
      light: '#dc2626',
      dark: '#ef4444',
    },
  },
} satisfies ChartConfig

function transformData(data: DatosPorMes[]): ChartDataPoint[] {
  return data.map((item) => {
    const ingresos = item.ingresosVentas + item.ingresosServicios
    const gastos =
      item.gastosSalarios +
      item.gastosCompras +
      item.gastosMermas +
      item.gastosDeExplotacion
    return {
      periodo: item.mes,
      ingresos,
      gastos,
      beneficio: ingresos - gastos,
    }
  })
}

export function formatYAxisTick(value: number): string {
  const prefix = value < 0 ? '-' : ''
  const absoluteValue = Math.abs(value)

  if (absoluteValue < 1000) {
    return `${prefix}$${absoluteValue.toLocaleString('es')}`
  }

  return `${prefix}$${yAxisTickCompactFormatter.format(absoluteValue).replace(/\u00a0/g, ' ')}`
}

/**
 * @description Chart de áreas que muestra ingresos vs gastos por mes.
 * @param {ChartAreaInteractiveProps} props - Datos mensuales del dashboard.
 * @returns {JSX.Element} Card con el chart de áreas recharts.
 */
export function ChartAreaInteractive({ data }: ChartAreaInteractiveProps) {
  const gradientId = useId()

  if (!data || data.length === 0) {
    return (
      <Card className='min-w-0'>
        <CardHeader>
          <CardTitle>Ingresos vs Gastos</CardTitle>
          <CardDescription>Evolución mensual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex h-[300px] items-center justify-center text-muted-foreground'>
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = transformData(data)

  return (
    <Card className='min-w-0'>
      <CardHeader>
        <CardTitle>Ingresos vs Gastos</CardTitle>
        <CardDescription>Evolución mensual de ingresos y gastos</CardDescription>
      </CardHeader>
      <CardContent className='min-w-0'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[350px] min-w-0 max-w-full'
        >
          <AreaChart
            data={chartData}
            margin={{ left: 12, right: 12 }}
          >
            <defs>
              <linearGradient
                id={`fillIngresos-${gradientId}`}
                x1='0' y1='0' x2='0' y2='1'
              >
                <stop
                  offset='5%'
                  stopColor='var(--color-ingresos)'
                  stopOpacity={0.4}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-ingresos)'
                  stopOpacity={0.05}
                />
              </linearGradient>
              <linearGradient
                id={`fillGastos-${gradientId}`}
                x1='0' y1='0' x2='0' y2='1'
              >
                <stop
                  offset='5%'
                  stopColor='var(--color-gastos)'
                  stopOpacity={0.4}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-gastos)'
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='periodo'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatYAxisTick}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
            />
            <Area
              dataKey='ingresos'
              type='monotone'
              fill={`url(#fillIngresos-${gradientId})`}
              fillOpacity={1}
              stroke='var(--color-ingresos)'
            />
            <Area
              dataKey='gastos'
              type='monotone'
              fill={`url(#fillGastos-${gradientId})`}
              fillOpacity={1}
              stroke='var(--color-gastos)'
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
