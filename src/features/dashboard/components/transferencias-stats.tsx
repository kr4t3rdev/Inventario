import { ArrowRightLeft, Store, Warehouse } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * @description Data contract for transfer statistics between locations.
 */
export interface TransferenciasStats {
  almacenAAlmacen: number
  almacenAPuntoVenta: number
  puntoVentaAAlmacen: number
  puntoVentaAPuntoVenta: number
}

interface TransferenciasStatsCardProps {
  transferenciasStats: TransferenciasStats
}

interface StatItem {
  key: keyof TransferenciasStats
  label: string
  iconFrom: React.ReactNode
  iconTo: React.ReactNode
}

const STAT_ITEMS: StatItem[] = [
  {
    key: "almacenAAlmacen",
    label: "Almacén → Almacén",
    iconFrom: <Warehouse className="h-4 w-4 text-blue-600" />,
    iconTo: <Warehouse className="h-4 w-4 text-blue-600" />,
  },
  {
    key: "almacenAPuntoVenta",
    label: "Almacén → Punto de Venta",
    iconFrom: <Warehouse className="h-4 w-4 text-blue-600" />,
    iconTo: <Store className="h-4 w-4 text-emerald-600" />,
  },
  {
    key: "puntoVentaAAlmacen",
    label: "Punto de Venta → Almacén",
    iconFrom: <Store className="h-4 w-4 text-emerald-600" />,
    iconTo: <Warehouse className="h-4 w-4 text-blue-600" />,
  },
  {
    key: "puntoVentaAPuntoVenta",
    label: "Punto de Venta → Punto de Venta",
    iconFrom: <Store className="h-4 w-4 text-emerald-600" />,
    iconTo: <Store className="h-4 w-4 text-emerald-600" />,
  },
]

/**
 * @description Renders transfer statistics between locations (warehouses and points of sale).
 * This is a presentational Server Component — it receives data via props and renders a Card
 * with a 2x2 grid showing count badges for each transfer type.
 *
 * @param {TransferenciasStatsCardProps} props - Component props
 * @returns {JSX.Element} A Card with transfer stats in a 2x2 grid
 */
export function TransferenciasStats({
  transferenciasStats,
}: TransferenciasStatsCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          Transferencias
        </CardTitle>
        <CardDescription>
          Movimientos de inventario entre ubicaciones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {STAT_ITEMS.map((item) => {
            const count = transferenciasStats[item.key]

            return (
              <div
                key={item.key}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3"
              >
                <div className="flex items-center gap-1.5">
                  {item.iconFrom}
                  <ArrowRightLeft className="h-3 w-3 text-muted-foreground/60" />
                  {item.iconTo}
                </div>

                <span className="text-xs text-muted-foreground leading-tight">
                  {item.label}
                </span>

                <Badge
                  variant={count === 0 ? "outline" : "default"}
                  className="self-start"
                >
                  {count}
                </Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
