"use client"

/**
 * @description Entrada de la leyenda del gráfico por categoría.
 * Recharts inyecta estas props al clonar el elemento pasado a <Legend content={...} />.
 */
interface CategoryLegendEntry {
  value: string
  color: string
  payload: { percent?: number }
}

interface CategoryLegendProps {
  /** Recharts inyecta este prop al clonar el elemento; el default vacío solo aplica al render directo. */
  payload?: CategoryLegendEntry[]
}

/**
 * @description Leyenda del pie "Distribución por Categoría" con altura acotada y scroll.
 * La versión anterior crecía sin límite (una fila por categoría) y, al superar la
 * altura del contenedor, recharts desplazaba el pie hacia arriba fuera del svg.
 * @param {CategoryLegendProps} props - Entradas inyectadas por recharts Legend
 * @returns {JSX.Element} Lista de categorías con color y porcentaje
 */
export function CategoryLegend({ payload = [] }: CategoryLegendProps): JSX.Element {
  return (
    <ul className="mt-4 max-h-40 space-y-2 overflow-y-auto pr-1">
      {payload.map((entry) => (
        <li key={entry.value} className="flex items-center gap-2 text-sm">
          <span
            className="h-4 w-4 flex-shrink-0 rounded"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-medium text-foreground/80">{entry.value}</span>
          <span className="ml-auto text-muted-foreground">
            ({((entry.payload.percent ?? 0) * 100).toFixed(1)}%)
          </span>
        </li>
      ))}
    </ul>
  )
}
