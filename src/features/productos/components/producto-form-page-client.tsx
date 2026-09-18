"use client"

import { LazyMotion, m as motion } from 'framer-motion'
import { Boxes, AlertCircle, History, Package, TrendingUp } from 'lucide-react'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProductoForm } from '@/features/productos/components/productos-form'
import { RestockDialog } from '@/features/productos/components/restock-dialog'
import { RestockHistoryDialog } from '@/features/productos/components/restock-history-dialog'
import { CostHistoryDialog } from '@/features/productos/components/cost-history-dialog'
import type { Almacen, Categoria, Producto, Unidad, Vendor } from '@/app/models/model'

interface ProductoFormPageClientProps {
  mode: 'new' | 'edit'
  producto?: Producto
  unidades?: Pick<Unidad, 'unidadId' | 'nombre' | 'simbolo'>[]
  almacenes?: Pick<Almacen, 'almacenId' | 'nombre'>[]
  listasPrecios?: Array<{ id: string; nombre: string }>
  vendors?: Array<Pick<any, 'nombre' | 'vendorId' | 'proveedorCodigo'>>
  categorias?: Array<Pick<Categoria, 'catId' | 'nombre'> & { parentId?: string | null }>
  loading?: boolean
}

/**
 * @description Shell visual client-side para páginas de creación/edición de producto.
 * @param {ProductoFormPageClientProps} props - Datos y catálogos para el formulario.
 * @returns {JSX.Element} Shell visual del formulario.
 */
export function ProductoFormPageClient({
  mode,
  producto,
  unidades = [],
  almacenes = [],
  listasPrecios = [],
  vendors = [],
  categorias = [],
  loading = false,
}: ProductoFormPageClientProps): React.JSX.Element {
  if (loading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <motion.div className="mb-6 flex items-center gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-80" />
              </div>
            </motion.div>
            <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
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

  if (mode === 'edit' && !producto) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <motion.div className="container mx-auto py-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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

  const title = mode === 'edit' ? 'Editar producto' : 'Nuevo Producto'
  const description = mode === 'edit'
    ? `Actualiza inventario, precios y estructura del producto ${producto?.nombre ? `'${producto.nombre}'` : ''}.`
    : 'Ingrese los datos para registrar un nuevo producto en el inventario'

  return (
    <SidebarProvider>
      <SidebarInset>
        <motion.div className="container mx-auto py-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
            <div className="flex items-center gap-3 mb-2">
              <motion.div className="w-12 h-12 bg-linear-to-br from-primary to-purple rounded-xl flex items-center justify-center shadow-lg relative" whileHover={{ scale: 1.05, rotate: 5 }} transition={{ duration: 0.2 }}>
                <Boxes className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  {title}
                </h1>
                <p className="text-muted-foreground">{description}</p>
              </div>
            </div>
          </motion.div>

          {mode === 'edit' && producto ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <motion.div className="mb-6 flex flex-wrap gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                <RestockDialog
                  producto={producto}
                  trigger={<Button variant="outline" className="gap-2 border-dashed"><Package className="h-4 w-4" />Restock</Button>}
                />
                <RestockHistoryDialog
                  productoId={producto.id}
                  productoNombre={producto.nombre}
                  trigger={<Button variant="outline" className="gap-2 border-dashed"><History className="h-4 w-4" />Historial</Button>}
                />
                <CostHistoryDialog
                  productoId={producto.id}
                  productoNombre={producto.nombre}
                  trigger={<Button variant="outline" className="gap-2 border-dashed"><TrendingUp className="h-4 w-4" />Historial de costos</Button>}
                />
              </motion.div>

              <motion.div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                <Card className="border-dashed bg-linear-to-br from-primary/[0.06] to-transparent dark:from-primary/10">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Stock actual</p>
                    <p className="mt-2 text-2xl font-semibold">{producto.stock} {producto.unidad?.simbolo || 'u'}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed bg-linear-to-br from-primary/[0.06] to-transparent dark:from-primary/10">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Stock mínimo</p>
                    <p className="mt-2 text-2xl font-semibold">{producto.stockMinimo > 0 ? producto.stockMinimo : 10} {producto.unidad?.simbolo || 'u'}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed bg-linear-to-br from-primary/[0.06] to-transparent dark:from-primary/10">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
                    <Badge variant={producto.stock === 0 ? 'destructive' : (producto.stock - (producto.stockMinimo > 0 ? producto.stockMinimo : 10)) <= 0 ? 'secondary' : 'default'} className="mt-2">
                      {producto.stock === 0 ? 'Sin stock' : (producto.stock - (producto.stockMinimo > 0 ? producto.stockMinimo : 10)) <= 0 ? 'Stock bajo' : 'Stock normal'}
                    </Badge>
                  </CardContent>
                </Card>
                <Card className="border-dashed bg-linear-to-br from-primary/[0.06] to-transparent dark:from-primary/10">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Diferencia</p>
                    <p className={`mt-2 text-2xl font-semibold ${producto.stock - (producto.stockMinimo > 0 ? producto.stockMinimo : 10) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      {producto.stock - (producto.stockMinimo > 0 ? producto.stockMinimo : 10) >= 0 ? `+${producto.stock - (producto.stockMinimo > 0 ? producto.stockMinimo : 10)}` : producto.stock - (producto.stockMinimo > 0 ? producto.stockMinimo : 10)}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <ProductoForm
                initialData={producto}
                unidades={unidades}
                almacenes={almacenes}
                listasPrecios={listasPrecios}
                vendors={vendors}
                categorias={categorias}
              />
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
              <ProductoForm
                unidades={unidades}
                almacenes={almacenes}
                listasPrecios={listasPrecios}
                vendors={vendors}
                categorias={categorias}
              />
            </motion.div>
          )}
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
