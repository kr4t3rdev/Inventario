import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { JSX } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { formatAccountingDate, getFunctionalCurrency } from './formatters';
import type { FinancialData } from './types';

interface BalanceResultsHeaderProps {
  data: FinancialData | null;
  activeView: 'balance' | 'resultados';
  year: string;
  yearOptions: number[];
  currentYear: number;
  isLoading: boolean;
  onYearChange: (value: string) => void;
  onRetry: () => void;
}

/**
 * @description Encabezado editorial del reporte con período, moneda y procedencia visibles.
 * @param {BalanceResultsHeaderProps} props - Estado y controles del reporte.
 * @returns {JSX.Element} Encabezado de la pantalla financiera.
 */
export function BalanceResultsHeader({
  data,
  activeView,
  year,
  yearOptions,
  currentYear,
  isLoading,
  onYearChange,
  onRetry,
}: BalanceResultsHeaderProps): JSX.Element {
  const currency = getFunctionalCurrency(data?.balance.monedaFuncional);
  const isSnapshot = data?.reporte.origen === 'SNAPSHOT';

  return (
    <header
      className="relative isolate overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 px-5 py-6 text-white shadow-2xl sm:px-7 lg:px-9 lg:py-8"
      style={{
        backgroundImage:
          'linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Control financiero</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">Cierre y desempeño</span>
          </div>
          <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl lg:text-[3.25rem] lg:leading-[1.05]">
            Balance general <span className="text-cyan-300">y resultados</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Una lectura verificable de tus recursos, obligaciones y desempeño del período contable.
          </p>
        </div>

        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm sm:w-auto sm:min-w-64">
          <div className="mb-3 flex items-center justify-between gap-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
              {activeView === 'balance' ? 'Período del balance' : 'Período de resultados'}
            </span>
            <span className="text-cyan-300">{isLoading ? 'Actualizando' : 'Listo'}</span>
          </div>
          <Select value={year} onValueChange={onYearChange} disabled={isLoading}>
            <SelectTrigger
              aria-label="Seleccionar período contable"
              className="h-11 w-full border-white/15 bg-slate-950/50 text-base text-white shadow-none hover:border-cyan-300/50 focus-visible:border-cyan-300 focus-visible:ring-cyan-300/40 sm:w-56"
            >
              <SelectValue placeholder="Selecciona un período" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((availableYear) => (
                <SelectItem key={availableYear} value={String(availableYear)}>
                  <span>{availableYear}</span>
                  {availableYear === currentYear && (
                    <span className="ml-2 text-xs text-muted-foreground">En curso</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              {isSnapshot ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
              ) : (
                <Clock3 className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              )}
              {isSnapshot ? 'Snapshot aprobado' : 'Corte provisional'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRetry}
              disabled={isLoading}
              aria-label="Actualizar reporte financiero"
              className="h-11 min-w-11 px-2 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} aria-hidden="true" />
              <span className="sr-only">Actualizar</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-7 grid gap-3 border-t border-white/10 pt-4 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <span>
            Moneda funcional <strong className="ml-1 font-semibold text-slate-100">{currency}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <span>
            Corte <strong className="ml-1 font-semibold text-slate-100">{formatAccountingDate(data?.reporte.fechaCorte, true)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <span>
            Actualizado <strong className="ml-1 font-semibold text-slate-100">{formatAccountingDate(data?.reporte.fechaCorte, true)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <ShieldCheck className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <span>
            Evidencia <strong className="ml-1 font-semibold text-slate-100">{data?.reporte.integridad === 'VALID' ? 'íntegra' : 'en revisión'}</strong>
          </span>
        </div>
      </div>
    </header>
  );
}
