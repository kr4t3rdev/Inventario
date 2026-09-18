import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, ReceiptText, TrendingUp } from 'lucide-react';
import type { JSX } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { formatMoney, getFunctionalCurrency } from './formatters';
import type { IncomeStatementData, MonthlyIncomeStatement } from './types';

interface IncomeStatementProps {
  statement: IncomeStatementData;
  currency?: string;
  isVisible?: boolean;
}

/**
 * @description Vista anual y mensual del estado de resultados con tabla alternativa al gráfico.
 * @param {IncomeStatementProps} props - Estado de resultados, moneda funcional y visibilidad del gráfico.
 * @returns {JSX.Element} Panel de rendimiento financiero.
 */
export function IncomeStatement({ statement, currency: rawCurrency, isVisible = true }: IncomeStatementProps): JSX.Element {
  const currency = getFunctionalCurrency(rawCurrency);
  const annual = statement.anual;
  const hasMonthlyData = statement.mensual.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <ResultMetric label="Ingresos totales" value={annual.totalIngresos} detail="Ventas y servicios cobrados" tone="positive" currency={currency} icon={ArrowUpRight} />
        <ResultMetric label="Gastos totales" value={annual.totalGastos} detail="Compras, operación y nómina" tone="negative" currency={currency} icon={ArrowDownRight} />
        <ResultMetric label="Utilidad neta" value={annual.utilidadNeta} detail="Resultado reconciliado del período" tone={annual.utilidadNeta >= 0 ? 'positive' : 'negative'} currency={currency} icon={TrendingUp} />
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl tracking-[-0.03em]">Ritmo mensual</CardTitle>
              <CardDescription className="mt-2">Ingresos, gastos y utilidad neta del período seleccionado. Moneda funcional: {currency}.</CardDescription>
            </div>
            <ChartNoAxesCombined className="h-5 w-5 text-cyan-accent" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {hasMonthlyData ? (
            isVisible ? (
              <div className="h-[280px] w-full sm:h-[340px]" role="img" aria-label="Gráfico mensual de ingresos, gastos y utilidad neta">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={240}>
                  <BarChart data={statement.mensual} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
                    <XAxis dataKey="monthName" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                    <Tooltip
                      cursor={{ fill: 'var(--cyan-accent-border)' }}
                      formatter={(value, name) => [formatMoney(Number(value), currency), String(name)]}
                      contentStyle={{ borderRadius: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Bar dataKey="totalIngresos" name="Ingresos" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="totalGastos" name="Gastos" fill="var(--danger)" radius={[5, 5, 0, 0]} />
                    <Line type="monotone" dataKey="utilidadNeta" name="Utilidad neta" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-5 text-center">
                <ReceiptText className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
                <p className="mt-3 font-medium">El gráfico se cargará al activar esta pestaña</p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Puede revisar el detalle mensual en la tabla mientras tanto.</p>
              </div>
            )
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-5 text-center">
              <ReceiptText className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
              <p className="mt-3 font-medium">Aún no hay movimientos mensuales</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">El gráfico aparecerá cuando el período tenga ingresos o gastos reconciliados.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <MonthlyDetail rows={statement.mensual} currency={currency} />
    </div>
  );
}

type ResultTone = 'positive' | 'negative';

interface ResultMetricProps {
  label: string;
  value: number;
  detail: string;
  tone: ResultTone;
  currency: string;
  icon: typeof ArrowUpRight;
}

/**
 * @description Tarjeta de resultado anual con semántica de ganancia o costo.
 * @param {ResultMetricProps} props - Datos y tono de la métrica.
 * @returns {JSX.Element} Tarjeta de resultado.
 */
function ResultMetric({ label, value, detail, tone, currency, icon: Icon }: ResultMetricProps): JSX.Element {
  const positive = tone === 'positive';
  return (
    <Card className={cn('border-border/70 shadow-sm', positive ? 'bg-emerald-50/40 dark:bg-emerald-950/15' : 'bg-rose-50/40 dark:bg-rose-950/15')}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardDescription className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</CardDescription>
          <CardTitle className={cn('mt-3 font-mono text-2xl tracking-[-0.04em] sm:text-3xl', positive ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
            {formatMoney(value, currency)}
          </CardTitle>
        </div>
        <Icon className={cn('h-5 w-5', positive ? 'text-emerald-600' : 'text-rose-600')} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

interface MonthlyDetailProps {
  rows: MonthlyIncomeStatement[];
  currency: string;
}

/**
 * @description Detalle mensual accesible en tabla de escritorio y tarjetas en móvil.
 * @param {MonthlyDetailProps} props - Filas mensuales y moneda funcional.
 * @returns {JSX.Element} Detalle responsive del estado de resultados.
 */
function MonthlyDetail({ rows, currency }: MonthlyDetailProps): JSX.Element {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/20">
        <CardTitle className="text-xl tracking-[-0.03em]">Detalle mensual</CardTitle>
        <CardDescription className="mt-2">La tabla conserva las cifras para revisión y exportación manual.</CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No hay meses con actividad para mostrar.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">Detalle mensual de ingresos, costos, gastos y utilidad</caption>
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="pb-3 font-semibold">Mes</th>
                    <th className="pb-3 text-right font-semibold">Ingresos</th>
                    <th className="pb-3 text-right font-semibold">Costo venta</th>
                    <th className="pb-3 text-right font-semibold">Gastos op.</th>
                    <th className="pb-3 text-right font-semibold">Compras</th>
                    <th className="pb-3 text-right font-semibold">Utilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => <MonthlyRow key={row.month} row={row} currency={currency} />)}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {rows.map((row) => (
                <article key={row.month} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold capitalize">{row.monthName || `Mes ${row.month}`}</h3>
                    <span className={cn('font-mono text-sm font-semibold', row.utilidadNeta >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
                      {formatMoney(row.utilidadNeta, currency)}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <MonthlyValue label="Ingresos" value={row.totalIngresos} currency={currency} />
                    <MonthlyValue label="Costo venta" value={row.ventasCosto} currency={currency} />
                    <MonthlyValue label="Gastos op." value={row.gastosSalarios + row.gastosGenerales + row.gastosMermas} currency={currency} />
                    <MonthlyValue label="Compras" value={row.gastosCompras} currency={currency} />
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface MonthlyRowProps {
  row: MonthlyIncomeStatement;
  currency: string;
}

/**
 * @description Fila de tabla para un mes del estado de resultados.
 * @param {MonthlyRowProps} props - Mes y moneda.
 * @returns {JSX.Element} Fila tabular.
 */
function MonthlyRow({ row, currency }: MonthlyRowProps): JSX.Element {
  const operatingExpenses = row.gastosSalarios + row.gastosGenerales + row.gastosMermas;
  return (
    <tr className="border-b border-border/50 transition-colors hover:bg-muted/35">
      <td className="py-3 font-medium capitalize">{row.monthName || `Mes ${row.month}`}</td>
      <td className="py-3 text-right font-mono tabular-nums">{formatMoney(row.totalIngresos, currency)}</td>
      <td className="py-3 text-right font-mono tabular-nums text-rose-700 dark:text-rose-300">{formatMoney(row.ventasCosto, currency)}</td>
      <td className="py-3 text-right font-mono tabular-nums text-rose-700 dark:text-rose-300">{formatMoney(operatingExpenses, currency)}</td>
      <td className="py-3 text-right font-mono tabular-nums text-rose-700 dark:text-rose-300">{formatMoney(row.gastosCompras, currency)}</td>
      <td className={cn('py-3 text-right font-mono font-semibold tabular-nums', row.utilidadNeta >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
        {formatMoney(row.utilidadNeta, currency)}
      </td>
    </tr>
  );
}

interface MonthlyValueProps {
  label: string;
  value: number;
  currency: string;
}

/**
 * @description Pareja etiqueta/importe usada en el detalle móvil.
 * @param {MonthlyValueProps} props - Etiqueta, valor y moneda.
 * @returns {JSX.Element} Elemento de lista descriptiva.
 */
function MonthlyValue({ label, value, currency }: MonthlyValueProps): JSX.Element {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-xs tabular-nums">{formatMoney(value, currency)}</dd>
    </div>
  );
}
