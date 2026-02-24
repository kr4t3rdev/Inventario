"use client";

import React, { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

interface ChartWrapperProps {
  chartType: 'line' | 'bar' | 'area';
  data: Array<Record<string, unknown>>;
  xAxisKey: string;
  dataKeys: Array<{
    key: string;
    color: string;
    name: string;
    fill?: string;
  }>;
  width?: number | string;
  height?: number | string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number, name: string) => [string, string];
  labelFormatter?: (label: string) => string;
}

const LineChartMemo = memo(function LineChartMemo({
  data,
  xAxisKey,
  dataKeys,
  yAxisFormatter,
  tooltipFormatter,
  labelFormatter,
}: Omit<ChartWrapperProps, 'chartType' | 'width' | 'height'>): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => (labelFormatter ? labelFormatter(String(value)) : String(value))}
        />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
        <Tooltip
          formatter={(value: number, name: string) =>
            tooltipFormatter ? tooltipFormatter(value, name) : [String(value), name]
          }
          labelFormatter={(label) => (labelFormatter ? labelFormatter(label) : label)}
        />
        <Legend />
        {dataKeys.map((dk) => (
          <Line
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            stroke={dk.color}
            strokeWidth={2}
            name={dk.name}
            dot={{ fill: dk.color, strokeWidth: 2, r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
});

const BarChartMemo = memo(function BarChartMemo({
  data,
  xAxisKey,
  dataKeys,
  yAxisFormatter,
  tooltipFormatter,
}: Omit<ChartWrapperProps, 'chartType' | 'width' | 'height'>): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
        <Tooltip
          formatter={(value: number, name: string) =>
            tooltipFormatter ? tooltipFormatter(value, name) : [String(value), name]
          }
        />
        <Legend />
        {dataKeys.map((dk) => (
          <Bar key={dk.key} dataKey={dk.key} fill={dk.fill || dk.color} name={dk.name} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
});

const AreaChartMemo = memo(function AreaChartMemo({
  data,
  xAxisKey,
  dataKeys,
  yAxisFormatter,
  tooltipFormatter,
  labelFormatter,
}: Omit<ChartWrapperProps, 'chartType' | 'width' | 'height'>): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => (labelFormatter ? labelFormatter(String(value)) : String(value))}
        />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
        <Tooltip
          formatter={(value: number, name: string) =>
            tooltipFormatter ? tooltipFormatter(value, name) : [String(value), name]
          }
          labelFormatter={(label) => (labelFormatter ? labelFormatter(label) : label)}
        />
        <Legend />
        {dataKeys.map((dk) => (
          <Area
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            stroke={dk.color}
            fill={dk.color}
            fillOpacity={0.3}
            name={dk.name}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
});

function ChartWrapper({
  chartType,
  data,
  xAxisKey,
  dataKeys,
  yAxisFormatter,
  tooltipFormatter,
  labelFormatter,
}: ChartWrapperProps): React.JSX.Element {
  const chartProps = {
    data,
    xAxisKey,
    dataKeys,
    yAxisFormatter,
    tooltipFormatter,
    labelFormatter,
  };

  switch (chartType) {
    case 'bar':
      return <BarChartMemo {...chartProps} />;
    case 'area':
      return <AreaChartMemo {...chartProps} />;
    case 'line':
    default:
      return <LineChartMemo {...chartProps} />;
  }
}

export const CostImpactChart = memo(function CostImpactChart({
  timeline,
  height = 80,
}: {
  timeline: Array<{
    fecha: string;
    costo_historico: number;
    costo_reposicion: number;
  }>;
  height?: number;
}): React.JSX.Element {
  const chartData = useMemo(() => timeline, [timeline]);

  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      <ChartWrapper
        chartType="line"
        data={chartData}
        xAxisKey="fecha"
        dataKeys={[
          { key: 'costo_historico', color: '#2563eb', name: 'Costo Histórico' },
          { key: 'costo_reposicion', color: '#dc2626', name: 'Costo Reposición' },
        ]}
        yAxisFormatter={(value) => `$${value.toLocaleString()}`}
        tooltipFormatter={(value, name) => [
          `$${value.toLocaleString()}`,
          name === 'costo_historico' ? 'Costo Histórico' : 'Costo Reposición',
        ]}
        labelFormatter={(label) => new Date(label).toLocaleDateString()}
      />
    </div>
  );
});

export const DebtExposureChart = memo(function DebtExposureChart({
  deudaOriginal,
  deudaActual,
  height = 80,
}: {
  deudaOriginal: number;
  deudaActual: number;
  height?: number;
}): React.JSX.Element {
  const chartData = useMemo(
    () => [
      {
        name: 'Deuda',
        deuda_original: deudaOriginal,
        deuda_actual: deudaActual,
      },
    ],
    [deudaOriginal, deudaActual]
  );

  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      <ChartWrapper
        chartType="bar"
        data={chartData}
        xAxisKey="name"
        dataKeys={[
          { key: 'deuda_original', color: '#2563eb', name: 'Deuda Original', fill: '#2563eb' },
          { key: 'deuda_actual', color: '#dc2626', name: 'Deuda Actual', fill: '#dc2626' },
        ]}
        yAxisFormatter={(value) => `$${value.toLocaleString()}`}
      />
    </div>
  );
});

export const MarginChart = memo(function MarginChart({
  tendenciaHistorica,
  height = 48,
}: {
  tendenciaHistorica: Array<{
    fecha: string;
    margen_nominal: number;
    margen_real: number;
  }>;
  height?: number;
}): React.JSX.Element | null {
  const chartData = useMemo(() => tendenciaHistorica, [tendenciaHistorica]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      <ChartWrapper
        chartType="line"
        data={chartData}
        xAxisKey="fecha"
        dataKeys={[
          { key: 'margen_nominal', color: '#2563eb', name: 'Margen Nominal' },
          { key: 'margen_real', color: '#16a34a', name: 'Margen Real' },
        ]}
        tooltipFormatter={(value, name) => [
          `$${value.toLocaleString()}`,
          name === 'margen_nominal' ? 'Margen Nominal' : 'Margen Real',
        ]}
        labelFormatter={(label) => new Date(label).toLocaleDateString()}
      />
    </div>
  );
});

export const UtilityChart = memo(function UtilityChart({
  actual,
  proyectado,
  height = 48,
}: {
  actual: number;
  proyectado: number;
  height?: number;
}): React.JSX.Element {
  const chartData = useMemo(
    () => [
      { escenario: 'Actual', utilidad: actual },
      { escenario: 'Proyectado', utilidad: proyectado },
    ],
    [actual, proyectado]
  );

  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      <ChartWrapper
        chartType="area"
        data={chartData}
        xAxisKey="escenario"
        dataKeys={[{ key: 'utilidad', color: '#8b5cf6', name: 'Utilidad Neta' }]}
        tooltipFormatter={(value) => [`$${value.toLocaleString()}`, 'Utilidad Neta']}
      />
    </div>
  );
});

export default ChartWrapper;
