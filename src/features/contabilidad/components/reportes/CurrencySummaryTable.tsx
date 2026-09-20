"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface CurrencyRow {
  moneda: string;
  saldoActual: number;
  totalIngresos: number;
  totalEgresos: number;
}

interface CurrencySummaryTableProps {
  data: CurrencyRow[];
  monedaPrincipal: string;
}

export function CurrencySummaryTable({ data, monedaPrincipal }: CurrencySummaryTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="bg-slate-50/80 dark:bg-slate-900/50">
            <TableHead className="font-semibold">Moneda</TableHead>
            <TableHead className="font-semibold text-right">Saldo Actual</TableHead>
            <TableHead className="font-semibold text-right">Ingresos</TableHead>
            <TableHead className="font-semibold text-right">Egresos</TableHead>
            <TableHead className="font-semibold text-right">Flujo Neto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const netFlow = row.totalIngresos - row.totalEgresos;
            const isPrincipal = row.moneda === monedaPrincipal;

            return (
              <TableRow key={row.moneda} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">{row.moneda}</Badge>
                    {isPrincipal && <span className="text-[10px] uppercase text-slate-400 font-bold">Principal</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {(row.saldoActual ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {(row.totalIngresos ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                  {(row.totalEgresos ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-mono tabular-nums font-semibold",
                  netFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}>
                  <div className="flex items-center justify-end gap-1">
                    {netFlow >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {(netFlow ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
