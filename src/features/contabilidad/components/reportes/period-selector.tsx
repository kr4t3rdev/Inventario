"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PeriodoClave } from "@/features/contabilidad/lib/periodo-presets";

interface PeriodSelectorProps {
  value: PeriodoClave;
  onChange: (value: PeriodoClave) => void;
}

const PERIODOS: Array<{ clave: PeriodoClave; etiqueta: string }> = [
  { clave: "hoy", etiqueta: "Hoy" },
  { clave: "semana", etiqueta: "Esta semana" },
  { clave: "mes", etiqueta: "Este mes" },
];

/**
 * @description Control segmentado para seleccionar el período del resumen financiero.
 * Expone `radiogroup` + `radio` nativos para máxima compatibilidad con lectores de
 * pantalla y navegación por teclado.
 * @param {PeriodSelectorProps} props - Valor actual y callback de cambio.
 * @returns {JSX.Element} Grupo de tres botones-radios accesibles.
 */
export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const mover = (direccion: -1 | 1) => {
    const index = PERIODOS.findIndex((p) => p.clave === value);
    const siguiente = PERIODOS[(index + direccion + PERIODOS.length) % PERIODOS.length];
    onChange(siguiente.clave);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Seleccionar período"
      className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
    >
      {PERIODOS.map((periodo) => {
        const activo = periodo.clave === value;
        return (
          <Button
            key={periodo.clave}
            type="button"
            role="radio"
            aria-checked={activo}
            variant={activo ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onChange(periodo.clave)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                mover(-1);
              }
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                mover(1);
              }
            }}
            className={cn(
              "h-7 px-3 text-xs font-medium transition-colors",
              activo && "shadow-sm",
            )}
          >
            {periodo.etiqueta}
          </Button>
        );
      })}
    </div>
  );
}
