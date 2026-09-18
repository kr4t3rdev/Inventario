"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrencyBalance {
  moneda: string;
  saldo: number;
  ingresos: number;
  egresos: number;
}

interface FinancialStatePanelProps {
  monedaPrincipal: string;
  flujoNeto: number;
  ingresosTotales: number;
  egresosTotales: number;
  balances: CurrencyBalance[];
  flujoNetoAnterior?: number | null;
}

export function FinancialStatePanel({
  monedaPrincipal,
  flujoNeto,
  ingresosTotales,
  egresosTotales,
  balances,
  flujoNetoAnterior = null,
}: FinancialStatePanelProps) {
  const isPositive = flujoNeto >= 0;
  const tieneComparacion = flujoNetoAnterior != null && flujoNetoAnterior !== 0;
  const deltaPct = tieneComparacion
    ? ((flujoNeto - flujoNetoAnterior) / Math.abs(flujoNetoAnterior)) * 100
    : 0;
  const deltaMejora = deltaPct >= 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Protagonist: Net Flow */}
      <Card className={cn(
        "lg:col-span-1 overflow-hidden border-0 shadow-md relative",
        isPositive ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-rose-50/50 dark:bg-rose-950/20"
      )}>
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className={cn("h-5 w-5", isPositive ? "text-emerald-600" : "text-rose-600")} />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Flujo Neto del Período
            </span>
          </div>
          <div className={cn(
            "text-4xl font-bold tracking-tighter tabular-nums",
            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {isPositive ? '+' : ''}
            {monedaPrincipal} {flujoNeto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
            <Badge variant="outline" className={cn(
              "border-0 bg-white/50 dark:bg-slate-900/50",
              isPositive ? "text-emerald-700" : "text-rose-700"
            )}>
              {isPositive ? 'Superávit' : 'Déficit'}
            </Badge>
            {tieneComparacion && (
              <Badge
                variant="outline"
                className={cn(
                  "border-0 bg-white/50 dark:bg-slate-900/50 gap-1",
                  deltaMejora ? "text-emerald-700" : "text-rose-700",
                )}
                aria-label={`Variación ${deltaPct > 0 ? 'positiva' : 'negativa'} del ${Math.abs(Math.round(deltaPct))} por ciento respecto al período anterior`}
              >
                {deltaMejora
                  ? <TrendingUp className="h-3 w-3" aria-hidden="true" />
                  : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
                {deltaPct > 0 ? '+' : ''}{Math.round(deltaPct)}% vs. período anterior
              </Badge>
            )}
            <span className="text-slate-500">en moneda principal</span>
          </div>
        </CardContent>
        <div className={cn(
          "absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-20",
          isPositive ? "bg-emerald-500" : "bg-rose-500"
        )} />
      </Card>

      {/* Secondary: Income & Expenses */}
      <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/20 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ingresos Totales</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {monedaPrincipal} {ingresosTotales.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/20 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Egresos Totales</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {monedaPrincipal} {egresosTotales.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
