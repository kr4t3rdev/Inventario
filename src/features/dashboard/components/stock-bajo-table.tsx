import { AlertTriangle, Package } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ProductoStockBajo {
  id: string
  nombre: string
  stock: number
  stockTotal: number
  stockMinimo: number
  diferencia: number
  umbralUsado: number
  categoria: { nombre: string }
  unidad: { simbolo: string }
}

interface StockBajoTableProps {
  productosStockBajo: ProductoStockBajo[]
}

type StatusInfo = {
  label: string
  variant: "destructive" | "outline"
  className: string
}

function getStockStatus(stockTotal: number, umbralUsado: number): StatusInfo {
  if (stockTotal === 0) {
    return {
      label: "Sin Stock",
      variant: "destructive",
      className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
    }
  }

  if (stockTotal <= umbralUsado * 0.5) {
    return {
      label: "Crítico",
      variant: "destructive",
      className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
    }
  }

  if (stockTotal <= umbralUsado) {
    return {
      label: "Bajo",
      variant: "outline",
      className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
    }
  }

  return {
    label: "Normal",
    variant: "outline",
    className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  }
}

/**
 * @description Widget que muestra productos con stock bajo o crítico.
 * Server Component presentacional — recibe datos por props, no tiene fetching propio.
 * @param {StockBajoTableProps} props - Lista de productos con stock bajo
 * @returns {JSX.Element} Card con tabla de stock bajo
 */
export function StockBajoTable({ productosStockBajo }: StockBajoTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Productos con Stock Bajo
        </CardTitle>
        <CardDescription>
          Productos que requieren reposición según sus umbrales configurados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {productosStockBajo.length > 0 ? (
          <>
            <Alert className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                {productosStockBajo.length} producto(s) requieren reposición inmediata
              </AlertDescription>
            </Alert>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                  <TableHead className="text-right">Stock Mínimo</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productosStockBajo.map((producto) => {
                  const status = getStockStatus(producto.stockTotal, producto.umbralUsado)
                  return (
                    <TableRow key={producto.id}>
                      <TableCell className="font-medium">{producto.nombre}</TableCell>
                      <TableCell>{producto.categoria.nombre}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono">
                          {producto.stockTotal} {producto.unidad.simbolo}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-muted-foreground">
                          {producto.stockMinimo === 0
                            ? "Por defecto (10)"
                            : `${producto.stockMinimo} ${producto.unidad.simbolo}`
                          }
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-mono ${
                            producto.diferencia > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {producto.diferencia > 0 ? "-" : "+"}
                          {Math.abs(producto.diferencia)} {producto.unidad.simbolo}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={status.variant} className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">¡Excelente!</h3>
            <p className="text-muted-foreground">
              Todos los productos tienen stock suficiente según sus umbrales configurados
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
