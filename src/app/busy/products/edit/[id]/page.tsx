'use client'

import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertCircle, Boxes, History, Package, Sparkles } from 'lucide-react'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetProductoQuery } from '@/lib/redux/services/productosApi'
import { ProductoForm } from '@/components/productos/productos-form'
import { RestockDialog } from '@/components/productos/restock-dialog'
import { RestockHistoryDialog } from '@/components/productos/restock-history-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

/**
 * @description Página de edición de producto con resumen de inventario y acciones rápidas.
 * @returns {JSX.Element} Vista de edición del producto.
 */
export default function EditarProductosPage(): React.JSX.Element {
  const params = useParams()
  const productId = params.id as string

  const { data: producto, isLoading, error } = useGetProductoQuery(productId, {
    skip: !productId,
  })

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <motion.div
              className="mb-6 flex items-center gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-80" />
              </div>
            </motion.div>
            <motion.div
              className="grid grid-cols-1 gap-4 md:grid-cols-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </motion.div>
            <Skeleton className="mt-6 h-[540px] w-full rounded-xl" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error || !producto) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <motion.div
            className="container mx-auto py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Alert variant="destructive" className="max-w-2xl">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle>No se pudo cargar el producto</AlertTitle>
              <AlertDescription>
                Ocurrió un error al obtener la información del producto. Intenta recargar la página.
              </AlertDescription>
            </Alert>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const threshold = producto.stockMinimo > 0 ? producto.stockMinimo : 10
  const diferencia = producto.stock - threshold

  return (
    <SidebarProvider>
      <SidebarInset>
        <motion.div
          className="container mx-auto py-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          <motion.div
            className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="flex items-start gap-3">
              <motion.div
                className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg"
                whileHover={{ scale: 1.05, rotate: 4 }}
                transition={{ duration: 0.2 }}
              >
                <Boxes className="h-6 w-6" />
                <motion.span
                  className="absolute -right-1 -top-1"
                  animate={{ rotate: 360, scale: [1, 1.15, 1] }}
                  transition={{
                    rotate: { duration: 16, repeat: Infinity, ease: 'linear' },
                    scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                  }}
                >
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                </motion.span>
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Editar producto
                </h1>
                <p className="text-sm text-muted-foreground">
                  Actualiza inventario, precios y estructura del producto <strong>{producto.nombre}</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <RestockDialog
                producto={producto}
                trigger={
                  <Button variant="outline" className="gap-2 border-dashed">
                    <Package className="h-4 w-4" />
                    Restock
                  </Button>
                }
              />
              <RestockHistoryDialog
                productoId={producto.id}
                productoNombre={producto.nombre}
                trigger={
                  <Button variant="outline" className="gap-2 border-dashed">
                    <History className="h-4 w-4" />
                    Historial
                  </Button>
                }
              />
            </div>
          </motion.div>

          <motion.div
            className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <Card className="border-dashed bg-gradient-to-br from-primary/[0.06] to-transparent dark:from-primary/10">
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Stock actual</p>
                <p className="mt-2 text-2xl font-semibold">
                  {producto.stock} {producto.unidad?.simbolo || 'u'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-dashed bg-gradient-to-br from-primary/[0.06] to-transparent dark:from-primary/10">
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Stock mínimo</p>
                <p className="mt-2 text-2xl font-semibold">
                  {producto.stockMinimo > 0 ? producto.stockMinimo : 10} {producto.unidad?.simbolo || 'u'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-dashed bg-gradient-to-br from-primary/[0.06] to-transparent dark:from-primary/10">
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
                <Badge
                  variant={producto.stock === 0 ? 'destructive' : diferencia <= 0 ? 'secondary' : 'default'}
                  className="mt-2"
                >
                  {producto.stock === 0
                    ? 'Sin stock'
                    : diferencia <= 0
                    ? 'Stock bajo'
                    : 'Stock normal'}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-dashed bg-gradient-to-br from-primary/[0.06] to-transparent dark:from-primary/10">
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Diferencia</p>
                <p
                  className={`mt-2 text-2xl font-semibold ${
                    diferencia >= 0 ? 'text-emerald-500' : 'text-destructive'
                  }`}
                >
                  {diferencia >= 0 ? `+${diferencia}` : diferencia}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <Card className="mb-6 border-dashed bg-gradient-to-br from-primary/[0.05] via-background to-purple-500/[0.08] dark:from-primary/10 dark:to-purple-500/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Información de precios</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Precio costo actual</p>
                  <p className="text-lg font-semibold">${producto.precioCosto.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Precio venta actual</p>
                  <p className="text-lg font-semibold">${producto.precioVenta.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <ProductoForm initialData={producto} />
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
