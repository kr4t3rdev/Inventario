import { cn } from "@/lib/utils";

/**
 * @description Clase de superficie compartida para las tarjetas del módulo de reportes.
 *   Unifica el estilo visual (borde translúcido, fondo blanco con blur, tema oscuro)
 *   que antes estaba repetido con variantes en cada componente.
 *   Para superficies de nivel de página (hero, contenedores grandes), combinar como
 *   `cn(SURFACE_CARD_CLASS, "rounded-2xl ...variantes")`. Ver cp uso.
 */
export const SURFACE_CARD_CLASS = cn(
  "relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
  "dark:border-slate-800/60 dark:bg-slate-900/10",
);

/**
 * @description Paleta compartida para gráficos del módulo de reportes.
 *   Usa los tokens `--chart-N` del tema (globals.css), por lo que respeta
 *   modo claro/oscuro. Recharts acepta referencias `var(--…)` en `fill`/`stroke`.
 *   Cicla con `CHART_COLORS[i % CHART_COLORS.length]`.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** @description Color de serie para valores positivos (ingresos, ganancias). */
export const CHART_COLOR_POSITIVE = "var(--chart-2)";

/** @description Color de serie para valores negativos (pérdidas, egresos). */
export const CHART_COLOR_NEGATIVE = "var(--destructive)";
