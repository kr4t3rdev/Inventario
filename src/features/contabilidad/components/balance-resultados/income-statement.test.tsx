import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IncomeStatement } from './income-statement';
import type { IncomeStatementData, MonthlyIncomeStatement } from './types';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: (props: Record<string, unknown>) => <div data-testid={`bar-${String(props.dataKey)}`} />,
  Line: (props: Record<string, unknown>) => <div data-testid={`line-${String(props.dataKey)}`} />,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: (props: Record<string, unknown>) => <div data-testid="reference-line" data-y={props.y} />,
}));

const baseAnual = {
  totalIngresos: 500,
  gastosCompras: 80,
  gastosSalarios: 100,
  gastosGenerales: 50,
  gastosMermas: 10,
  totalGastos: 240,
  utilidadNeta: 260,
};

const monthlyRow: MonthlyIncomeStatement = {
  month: 1,
  monthName: 'Enero',
  totalIngresos: 300,
  ventasCosto: 60,
  gastosCompras: 40,
  gastosSalarios: 50,
  gastosGenerales: 25,
  gastosMermas: 5,
  totalGastos: 180,
  utilidadNeta: 120,
};

const monthlyNegative: MonthlyIncomeStatement = {
  month: 2,
  monthName: 'Febrero',
  totalIngresos: 50,
  ventasCosto: 20,
  gastosCompras: 10,
  gastosSalarios: 40,
  gastosGenerales: 15,
  gastosMermas: 5,
  totalGastos: 90,
  utilidadNeta: -40,
};

function makeStatement(mensual: MonthlyIncomeStatement[], overrides?: Partial<typeof baseAnual>): IncomeStatementData {
  return {
    mensual,
    anual: { ...baseAnual, ...overrides },
    incidencias: [],
  };
}

describe('IncomeStatement', () => {
  describe('tabla reconstruible', () => {
    it('presenta columnas separadas para costo de venta, gastos operativos y compras', () => {
      const statement = makeStatement([monthlyRow]);
      render(<IncomeStatement statement={statement} currency="CUP" />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent?.trim());

      expect(headerTexts).toContain('Compras');
      expect(headerTexts).toContain('Costo venta');
      expect(headerTexts).toContain('Gastos op.');
      expect(headerTexts).toContain('Utilidad');
    });

    it('muestra filas con datos desglosados por mes incluyendo compras', () => {
      const statement = makeStatement([monthlyRow]);
      render(<IncomeStatement statement={statement} currency="CUP" />);

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const dataRows = rows.slice(1);
      expect(dataRows.length).toBeGreaterThanOrEqual(1);

      const cells = within(dataRows[0]).getAllByRole('cell');
      expect(cells.length).toBe(6);
      expect(cells[0].textContent).toBe('Enero');
    });
  });

  describe('valores negativos comprensibles', () => {
    it('muestra utilidad negativa con prefijo de signo visible sin depender del color', () => {
      const statement = makeStatement([monthlyNegative]);
      render(<IncomeStatement statement={statement} currency="CUP" />);

      const negativeCells = screen.getAllByText(/-.*\$/);
      expect(negativeCells.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('alternativa textual al gráfico', () => {
    it('proporciona una tabla equivalente al gráfico con los mismos meses', () => {
      const statement = makeStatement([monthlyRow, monthlyNegative]);
      render(<IncomeStatement statement={statement} currency="CUP" />);

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const dataRows = rows.slice(1);
      expect(dataRows.length).toBe(2);
    });

    it('siempre muestra la tabla de detalle independientemente del gráfico', () => {
      const statement = makeStatement([monthlyRow]);
      render(<IncomeStatement statement={statement} currency="CUP" />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Detalle mensual')).toBeInTheDocument();
    });
  });

  describe('moneda funcional visible', () => {
    it('indica la moneda funcional en la descripción del gráfico', () => {
      const statement = makeStatement([monthlyRow]);
      render(<IncomeStatement statement={statement} currency="USD" />);

      expect(screen.getByText(/moneda funcional.*USD/i)).toBeInTheDocument();
    });
  });

  describe('gráficos y datos vacíos', () => {
    it('muestra estado vacío cuando no hay meses', () => {
      const statement = makeStatement([]);
      render(<IncomeStatement statement={statement} currency="CUP" />);

      expect(screen.getByText(/No hay meses con actividad/i)).toBeInTheDocument();
    });
  });

  describe('gráfico de barras y línea', () => {
    it('usa barras para ingresos y gastos, y línea para utilidad', () => {
      const statement = makeStatement([monthlyRow]);
      render(<IncomeStatement statement={statement} currency="CUP" />);

      expect(screen.getByTestId('bar-totalIngresos')).toBeInTheDocument();
      expect(screen.getByTestId('bar-totalGastos')).toBeInTheDocument();
      expect(screen.getByTestId('line-utilidadNeta')).toBeInTheDocument();
    });

    it('incluye una línea de referencia en cero para destacar meses con pérdida', () => {
      const statement = makeStatement([monthlyNegative]);
      render(<IncomeStatement statement={statement} currency="CUP" />);

      const refLine = screen.getByTestId('reference-line');
      expect(refLine).toHaveAttribute('data-y', '0');
    });
  });

  describe('carga bajo demanda del gráfico', () => {
    it('no carga el gráfico cuando isVisible es false', () => {
      const statement = makeStatement([monthlyRow]);
      render(<IncomeStatement statement={statement} currency="CUP" isVisible={false} />);

      expect(screen.queryByRole('img', { name: /gráfico mensual/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    });

    it('carga el gráfico cuando isVisible es true', () => {
      const statement = makeStatement([monthlyRow]);
      render(<IncomeStatement statement={statement} currency="CUP" isVisible={true} />);

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  describe('totales anuales', () => {
    it('muestra métricas anuales de ingresos, gastos y utilidad', () => {
      const statement = makeStatement([monthlyRow]);
      render(<IncomeStatement statement={statement} currency="CUP" />);

      expect(screen.getByText('Ingresos totales')).toBeInTheDocument();
      expect(screen.getByText('Gastos totales')).toBeInTheDocument();
      expect(screen.getByText('Utilidad neta')).toBeInTheDocument();
    });
  });
});
