"use client"
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { VentaForm } from "@/features/ventas"
import { getVentaByIdAction, updateVentaAction } from "@/features/ventas/actions"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { LazyMotion, m as motion } from "framer-motion"
import { TrendingUp, Sparkles, ArrowLeft, AlertCircle, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function EditarVentaPage() {
  const params = useParams()
  const router = useRouter()
  const ventaId = params.id as string
  const [venta, setVenta] = useState<Awaited<ReturnType<typeof getVentaByIdAction>>['data'] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    getVentaByIdAction(ventaId).then((res) => {
      if (res.success) {
        setVenta(res.data)
      } else {
        setError(res.error)
      }
      setIsLoading(false)
    })
  }, [ventaId])

  if (isLoading) {
    return (
          <div className="container mx-auto py-4">
            <motion.div 
              className="mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-48" />
              </div>
              <Skeleton className="h-4 w-64 ml-12" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center justify-center py-8 mb-6">
                <motion.div
                  className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
              </div>
            </motion.div>
          </div>
    )
  }

  if (error || !venta) {
    return (
          <div className="container mx-auto py-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Alert variant="destructive" className="border-dashed">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  No se pudo cargar la venta. Por favor, intente nuevamente.
                </AlertDescription>
              </Alert>
            </motion.div>
          </div>
    )
  }

  const items = venta.items || []
  const tieneMultiplesProductos = items.length > 1
  const itemUnico = items.length === 1 ? items[0] : null
  // @ts-expect-error
  const productoIdInicial = venta.productoId || itemUnico?.productoId || ""
  // @ts-expect-error
  const cantidadInicial = venta.productoId ? venta.cantidad : (itemUnico?.cantidad ?? venta.cantidad ?? 1)

  return (
        <div className="container mx-auto py-4">
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href="/busy/sales">
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
              <motion.div 
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <motion.div 
                  className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <TrendingUp className="h-5 w-5 text-white" />
                </motion.div>
                <div className="relative">
                  <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                    Editar Venta
                  </h1>
                  <motion.div
                    className="absolute -right-4 -top-1"
                    animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                    transition={{ 
                      rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                      scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    }}
                  >
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                  </motion.div>
                </div>
              </motion.div>
            </div>
            <motion.p 
              className="text-muted-foreground ml-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Modifique los datos de la venta
            </motion.p>
          </motion.div>

          {tieneMultiplesProductos ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="border-dashed">
                <div className="h-1 bg-linear-to-r from-orange-500 via-red-500 to-orange-500" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                    Edición bloqueada
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Esta venta contiene múltiples productos y no puede editarse desde este formulario.
                  </p>
                  <div className="rounded-md border border-dashed">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.producto?.nombre || item.productoId}</TableCell>
                            <TableCell className="text-right">{item.cantidad}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.precioUnitario || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => router.push("/busy/sales")}>
                      Volver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <VentaForm
                initialData={{
                  ventaId: venta.ventaId,
                  productoId: productoIdInicial,
                  cantidad: cantidadInicial,
                  puntoDeVentaId: venta.puntoDeVentaId,
                }}
              />
            </motion.div>
          )}
        </div>
  )
}
