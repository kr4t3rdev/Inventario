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
