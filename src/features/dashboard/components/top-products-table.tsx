import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

interface ProductoMasVendido {
  id: string
  nombre: string
  categoria: string
  ventas: number
  ingresos: number
  stock: number
}

interface TopProductsTableProps {
  productosMasVendidos: ProductoMasVendido[]
}

/**
 * @description Widget de tabla que muestra los 10 productos más vendidos del dashboard.
 * Recibe los datos por props, no tiene estado ni fetching propio.
 * @param {TopProductsTableProps} props - Lista de productos más vendidos
 * @returns {JSX.Element} Card con tabla de productos más vendidos
 */
export function TopProductsTable({
  productosMasVendidos,
}: TopProductsTableProps) {
  if (productosMasVendidos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Productos más vendidos</CardTitle>
          <CardDescription>
            Los 10 productos con mayores ventas del período
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground py-8 text-center text-sm'>
            No hay datos de productos vendidos en este período.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos más vendidos</CardTitle>
        <CardDescription>
          Los 10 productos con mayores ventas del período
        </CardDescription>
      </CardHeader>
      <CardContent className='p-0'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className='text-right'>Ingresos</TableHead>
              <TableHead className='text-right'>Ventas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productosMasVendidos.map((producto) => (
              <TableRow key={producto.id}>
                <TableCell className='font-medium'>
                  {producto.nombre}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(producto.ingresos)}
                </TableCell>
                <TableCell className='text-right'>
                  {producto.ventas}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
