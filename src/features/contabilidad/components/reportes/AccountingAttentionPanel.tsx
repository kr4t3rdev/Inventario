"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, Receipt, CreditCard, Calculator, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface AttentionItem {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  href: string;
  description: string;
}

interface AccountingAttentionPanelProps {
  ventasPend: number;
  serviciosPend: number;
  gastosPend: number;
  conversionesSinCobertura: number;
  clasificacionesNoReconocidas: number;
}

export function AccountingAttentionPanel({
  ventasPend,
  serviciosPend,
  gastosPend,
  conversionesSinCobertura,
  clasificacionesNoReconocidas,
}: AccountingAttentionPanelProps) {
  const items: AttentionItem[] = [
    {
      label: "Ventas pendientes",
      count: ventasPend,
      icon: <Receipt className="h-5 w-5" />,
      color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
      href: "/busy/contabilidad/reconciliacion/ventas",
      description: "Ventas que requieren validación bancaria"
    },
    {
      label: "Servicios pendientes",
      count: serviciosPend,
      icon: <CreditCard className="h-5 w-5" />,
      color: "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30",
      href: "/busy/contabilidad/reconciliacion/servicios",
      description: "Servicios no conciliados con el banco"
    },
    {
      label: "Gastos pendientes",
      count: gastosPend,
      icon: <Calculator className="h-5 w-5" />,
      color: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
      href: "/busy/contabilidad/reconciliacion/gastos",
      description: "Egresos sin respaldo bancario"
    },
    {
      label: "Conversiones sin cobertura",
      count: conversionesSinCobertura,
      icon: <Info className="h-5 w-5" />,
      color: "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30",
      href: "/busy/contabilidad/exchange",
      description: "Tasa de cambio no verificada"
    },
    {
      label: "Clasificaciones no reconocidas",
      count: clasificacionesNoReconocidas,
      icon: <AlertCircle className="h-5 w-5" />,
      color: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30",
      href: "/busy/contabilidad/reconciliacion",
      description: "Movimientos sin categoría asignada"
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        <AlertCircle className="h-4 w-4" />
        <span>Requiere Atención</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group relative block p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg transition-colors", item.color)}>
                  {item.icon}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {item.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="h-6 px-2 font-mono">
                  {item.count}
                </Badge>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
