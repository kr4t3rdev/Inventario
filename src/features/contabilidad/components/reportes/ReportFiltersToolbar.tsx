"use client";

import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ReportFiltersToolbarProps {
  periodo: string;
  cuentaActiva: string;
  monedaPrincipal: string;
  onRefresh: () => void;
  onClear: () => void;
  isRefreshing?: boolean;
  hasActiveFilters: boolean;
}

export function ReportFiltersToolbar({
  periodo,
  cuentaActiva,
  monedaPrincipal,
  onRefresh,
  onClear,
  isRefreshing,
  hasActiveFilters,
}: ReportFiltersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="h-8 px-3 gap-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-medium">{periodo}</span>
        </Badge>

        <Badge variant="outline" className="h-8 px-3 gap-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-medium">{cuentaActiva}</span>
        </Badge>

        <Badge variant="outline" className="h-8 px-3 gap-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <span className="text-xs font-mono font-bold">{monedaPrincipal}</span>
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Limpiar filtros"
            onClick={onClear}
            className="h-8 px-3 text-xs gap-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 px-3 text-xs gap-2"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          {isRefreshing ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>
    </div>
  );
}
