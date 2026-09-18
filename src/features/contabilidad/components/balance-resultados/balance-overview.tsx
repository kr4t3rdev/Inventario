import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Landmark, Scale, Wallet, Boxes, CircleDollarSign } from 'lucide-react';
import type { JSX } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { formatMoney, getFunctionalCurrency } from './formatters';
import type { BalanceData } from './types';

type MetricTone = 'cyan' | 'amber' | 'violet';

interface BalanceOverviewProps {
  balance: BalanceData;
}

interface MetricCardProps {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: MetricTone;
  currency: string;
}

interface BalanceSignalProps {
  label: string;
  value: number;
  source: string;
  currency: string;
}

const metricTones: Record<MetricTone, { icon: string; value: string; glow: string }> = {
  cyan: {
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
    value: 'text-slate-950 dark:text-white',
    glow: 'from-cyan-500/10',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    value: 'text-slate-950 dark:text-white',
    glow: 'from-amber-500/10',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
    value: 'text-slate-950 dark:text-white',
    glow: 'from-violet-500/10',
  },
};

/**
 * @description Tarjeta de métrica principal del balance.
 * @param {MetricCardProps} props - Etiqueta, importe, icono y color de la métrica.
 * @returns {JSX.Element} Tarjeta de resumen.
 */
function MetricCard({ label, value, detail, icon: Icon, tone, currency }: MetricCardProps): JSX.Element {
  const styles = metricTones[tone];

  return (
    <Card className={cn('relative overflow-hidden border-border/70 bg-card/90 shadow-sm transition-shadow duration-200 hover:shadow-md', `bg-gradient-to-br ${styles.glow} via-transparent to-transparent`)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardDescription className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</CardDescription>
          <CardTitle className={cn('mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl', styles.value)}>
            {formatMoney(value, currency)}
          </CardTitle>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', styles.icon)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

/**
 * @description Tarjeta compacta de saldo con la fuente visible.
 * @param {BalanceSignalProps} props - Saldo, fuente y moneda.
 * @returns {JSX.Element} Señal financiera secundaria.
 */
function BalanceSignal({ label, value, source, currency }: BalanceSignalProps): JSX.Element {
  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-sm font-semibold tabular-nums">{formatMoney(value, currency)}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground" title={source}>Fuente: {source}</p>
    </div>
  );
}

interface EquationProps {
  balance: BalanceData;
  currency: string;
}

/**
 * @description Presenta la ecuación contable con diferencia y estado textual.
 * @param {EquationProps} props - Balance y moneda funcional.
 * @returns {JSX.Element} Panel de ecuación contable.
 */
function EquationPanel({ balance, currency }: EquationProps): JSX.Element {
  const equation = balance.ecuacion ?? {
    assets: balance.activos.total,
    liabilitiesAndEquity: balance.pasivos.total + balance.patrimonio.total,
    difference: balance.activos.total - balance.pasivos.total - balance.patrimonio.total,
    status: 'SIN VERIFICAR',
  };
  const isBalanced = equation.status === 'CUADRADO' && equation.difference === 0;

  return (
    <Card className="border-slate-800 bg-slate-950 text-white shadow-[0_20px_50px_-30px_rgba(7,21,37,0.9)] dark:border-slate-700">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardDescription className="text-cyan-300">Prueba de consistencia</CardDescription>
            <CardTitle className="mt-2 text-xl tracking-[-0.03em] text-white">Activos = Pasivos + Patrimonio</CardTitle>
          </div>
          <Scale className="h-6 w-6 text-cyan-300" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <EquationValue label="Activos" value={equation.assets} currency={currency} />
          <span className="hidden text-2xl text-slate-500 sm:block" aria-hidden="true">=</span>
          <EquationValue label="Pasivos + Patrimonio" value={equation.liabilitiesAndEquity} currency={currency} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
          <span className="text-slate-400">Diferencia detectada</span>
          <span className={cn('font-mono font-semibold', isBalanced ? 'text-emerald-300' : 'text-amber-300')}>
            {formatMoney(equation.difference, currency)}
          </span>
        </div>
        <div className={cn('mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]', isBalanced ? 'text-emerald-300' : 'text-amber-300')}>
          {isBalanced ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : <ArrowDownRight className="h-4 w-4" aria-hidden="true" />}
          Estado: {isBalanced ? 'cuadrado' : equation.status.toLowerCase()}
        </div>
      </CardContent>
    </Card>
  );
}

interface EquationValueProps {
  label: string;
  value: number;
  currency: string;
}

/**
 * @description Valor individual de la ecuación contable.
 * @param {EquationValueProps} props - Etiqueta, valor y moneda.
 * @returns {JSX.Element} Valor destacado.
 */
function EquationValue({ label, value, currency }: EquationValueProps): JSX.Element {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold tracking-[-0.03em] text-white">{formatMoney(value, currency)}</p>
    </div>
  );
}

/**
 * @description Vista completa del balance general y su detalle de cuentas.
 * @param {BalanceOverviewProps} props - Datos del balance.
 * @returns {JSX.Element} Resumen de activos, pasivos, patrimonio y ecuación.
 */
export function BalanceOverview({ balance }: BalanceOverviewProps): JSX.Element {
  const currency = getFunctionalCurrency(balance.monedaFuncional);
  const quality = balance.cobertura?.complete === false ? 'Revisión pendiente' : 'Validado';
  const rows = [
    { label: 'Caja y bancos', category: 'Activo corriente', source: 'Cuentas bancarias', value: balance.activos.efectivo },
    { label: 'Cuentas por cobrar', category: 'Activo corriente', source: 'Cuentas por cobrar', value: balance.activos.cuentasPorCobrar },
    { label: 'Inventario de mercancías', category: 'Activo corriente', source: 'Stock y costos', value: balance.activos.inventario },
    { label: 'Deudas externas', category: 'Pasivo no corriente', source: 'Deuda externa', value: balance.pasivos.deudaExterna },
    { label: 'Cuentas por pagar', category: 'Pasivo corriente', source: 'Cuentas por pagar', value: balance.pasivos.cuentasPorPagar ?? 0 },
    { label: 'Capital social', category: 'Patrimonio', source: 'Aportes de capital', value: balance.patrimonio.capitalSocial },
    { label: 'Resultados acumulados', category: 'Patrimonio', source: 'Cierres aprobados', value: balance.patrimonio.resultadosAcumulados ?? 0 },
    { label: 'Resultado del período', category: 'Patrimonio', source: 'Reconciliaciones', value: balance.patrimonio.utilidadEjercicio },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total de activos" value={balance.activos.total} detail="Recursos controlados por la empresa" icon={Wallet} tone="cyan" currency={currency} />
        <MetricCard label="Total de pasivos" value={balance.pasivos.total} detail="Obligaciones pendientes de la empresa" icon={Landmark} tone="amber" currency={currency} />
        <MetricCard label="Patrimonio neto" value={balance.patrimonio.total} detail="Valor residual después de obligaciones" icon={CircleDollarSign} tone="violet" currency={currency} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <BalanceSignal label="Efectivo" value={balance.activos.efectivo} source="Cuentas bancarias" currency={currency} />
        <BalanceSignal label="Inventario" value={balance.activos.inventario} source="Stock y costos" currency={currency} />
        <BalanceSignal label="CxC" value={balance.activos.cuentasPorCobrar} source="Cuentas por cobrar" currency={currency} />
        <BalanceSignal label="CxP" value={balance.pasivos.cuentasPorPagar ?? 0} source="Cuentas por pagar" currency={currency} />
        <BalanceSignal label="Patrimonio" value={balance.patrimonio.total} source="Capital y cierres" currency={currency} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 bg-muted/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl tracking-[-0.03em]">Composición del balance</CardTitle>
                <CardDescription className="mt-2">Saldos agrupados por naturaleza contable.</CardDescription>
              </div>
              <Boxes className="h-5 w-5 text-cyan-accent" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <caption className="sr-only">Detalle de activos, pasivos y patrimonio</caption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Cuenta</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="pr-5 text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.label} className="transition-colors hover:bg-muted/35">
                      <TableCell className="pl-5 font-medium">{row.label}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span>{row.category}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground/75">Fuente: {row.source} · {quality}</span>
                    </TableCell>
                      <TableCell className="pr-5 text-right font-mono tabular-nums">{formatMoney(row.value, currency)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-cyan-200 bg-cyan-50/70 font-semibold dark:border-cyan-900 dark:bg-cyan-950/30">
                    <TableCell colSpan={2} className="pl-5">Total activos</TableCell>
                    <TableCell className="pr-5 text-right font-mono tabular-nums">{formatMoney(balance.activos.total, currency)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-slate-100/80 font-semibold dark:bg-slate-900/80">
                    <TableCell colSpan={2} className="pl-5">Pasivos + patrimonio</TableCell>
                    <TableCell className="pr-5 text-right font-mono tabular-nums">{formatMoney(balance.pasivos.total + balance.patrimonio.total, currency)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <EquationPanel balance={balance} currency={currency} />
      </div>
    </div>
  );
}
