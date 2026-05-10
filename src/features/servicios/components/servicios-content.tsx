'use client'

/**
 * @description Componente de contenido para Servicios (Client Component).
 * Maneja toda la interactividad: catálogo, carrito, búsqueda, eliminación.
 * Los datos iniciales se reciben como props desde el Server Component (page.tsx).
 * 
 * @param {ServiciosContentProps} props - Props del componente
 * @returns {JSX.Element} Interfaz de gestión de Servicios
 */
import { useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { deleteServicioAction } from '@/features/servicios/actions'
import type { VentaServicio } from '@/features/venta-servicios/types'
import { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2, ShoppingCart, Search, Package, CheckCircle, Truck } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/utils'
import dynamic from 'next/dynamic'

const DataTable = dynamic(() => import('@/components/data-table').then(mod => ({ default: mod.DataTable })))
const ServiciosCart = dynamic(() => import('@/features/servicios/components/servicios-cart').then(mod => ({ default: mod.default })))
const ServiciosRecibidosTable = dynamic(() => import('@/features/servicios/components/servicios-recibidos-table').then(mod => mod.ServiciosRecibidosTable))

interface Servicio {
  servicioId: string
  nombre: string
  precio: number
  descripcion: string
}

interface ServicioItem {
  cartItemId: string
  servicioId: string
  nombre: string
  precio: number
  costo: number
  descripcion: string
  cantidad: number
}

interface ServiciosContentProps {
  initialServicios: Servicio[]
  initialVentaServicios: VentaServicio[]
}

export function ServiciosContent({ initialServicios, initialVentaServicios }: ServiciosContentProps) {
  const [servicios, setServicios] = useState<Servicio[]>(initialServicios)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [servicioToDelete, setServicioToDelete] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<ServicioItem[]>([])
  const [isCartDialogOpen, setIsCartDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('catalogo')

  const filteredServices = servicios?.filter(
    (servicio) =>
      servicio.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      servicio.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addToCart = (servicio: Servicio) => {
    setCart([...cart, { ...servicio, cartItemId: crypto.randomUUID(), costo: 0, cantidad: 1 }])
    toast.success(`${servicio.nombre} agregado al carrito`)
  }

  const handleDeleteServicio = async () => {
    if (servicioToDelete) {
      startTransition(async () => {
        const r = await deleteServicioAction(servicioToDelete)
        if (r.success) {
          toast.success('Servicio eliminado exitosamente')
          const ref = await import('@/features/servicios/actions').then(m => m.getServiciosAction())
          if (ref.success) setServicios(ref.data ?? [])
        } else {
          toast.error(r.error?.message || 'Error al eliminar el servicio')
        }
        setServicioToDelete(null)
      })
    }
  }

  const ventaColumns: ColumnDef<unknown>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'))
        return <span className='text-muted-foreground'>{date.toLocaleDateString()}</span>
      }
    },
    {
      accessorKey: 'servicio.nombre',
      header: 'Servicio',
      cell: ({ row }) => (
        <span className='font-medium'>
          {row.getValue('servicio.nombre')}
        </span>
      )
    },
    {
      accessorKey: 'cantidad',
      header: 'Cantidad',
      cell: ({ row }) => (
        <Badge variant='outline'>{row.getValue('cantidad')}</Badge>
      )
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => (
        <span className='font-semibold text-green-600'>
          {formatCurrency(row.getValue('total'))}
        </span>
      )
    },
    {
      accessorKey: 'cliente.nombre',
      header: 'Cliente',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {row.getValue('cliente.nombre') || 'Sin cliente'}
        </span>
      )
    },
    {
      accessorKey: 'observaciones',
      header: 'Observaciones',
      cell: ({ row }) => (
        <span className='text-muted-foreground text-sm line-clamp-1'>
          {row.getValue('observaciones') || '-'}
        </span>
      )
    }
  ]

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className='container mx-auto py-4 px-4'>
            <div className='flex justify-between items-center mb-6'>
              <div className='flex items-center gap-2'>
                <Skeleton className='h-8 w-8 rounded-lg' />
                <Skeleton className='h-8 w-48' />
              </div>
              <div className='flex gap-2'>
                <Skeleton className='h-10 w-32' />
                <Skeleton className='h-10 w-32' />
              </div>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className='h-64 w-full rounded-lg' />
              ))}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <motion.div 
          className='container mx-auto py-4 px-4'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <motion.div 
            className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className='flex items-center gap-3'>
              <motion.div
                className='w-10 h-10 bg-linear-to-br from-orange-600 to-red-600 rounded-xl flex items-center justify-center shadow-lg'
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Package className='h-5 w-5 text-white' />
              </motion.div>
              <div>
                <h1 className='text-3xl font-bold'>Servicios</h1>
                <p className='text-muted-foreground text-sm'>Gestiona tu catálogo de servicios y ventas</p>
              </div>
            </div>
            
            <div className='flex gap-2'>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button asChild variant='outline'>
                  <Link href='/busy/servicios/prestados'>
                    <CheckCircle className='mr-2 h-4 w-4' /> Prestados
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button asChild variant='outline'>
                  <Link href='/busy/servicios/recibidos'>
                    <ShoppingCart className='mr-2 h-4 w-4' /> Recibidos
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  asChild 
                  className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg'
                >
                  <Link href='/busy/servicios/new'>
                    <Plus className='mr-2 h-4 w-4' /> Nuevo Servicio
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  onClick={() => setIsCartDialogOpen(true)}
                  disabled={cart.length === 0}
                  className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50'
                >
                  <ShoppingCart className='mr-2 h-4 w-4' /> 
                  Carrito ({cart.length})
                </Button>
              </motion.div>
            </div>
          </motion.div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <TabsList className='mb-6'>
                <TabsTrigger value='catalogo'>
                  <Package className='mr-2 h-4 w-4' />
                  Catálogo de Servicios
                </TabsTrigger>
                <TabsTrigger value='carrito'>
                  <ShoppingCart className='mr-2 h-4 w-4' />
                  Carrito ({cart.length})
                </TabsTrigger>
                <TabsTrigger value='vendidos'>
                  <CheckCircle className='mr-2 h-4 w-4' />
                  Servicios Utilizados
                </TabsTrigger>
                <TabsTrigger value='recibidos'>
                  <Truck className='mr-2 h-4 w-4' />
                  Servicios Recibidos
                </TabsTrigger>
              </TabsList>
            </motion.div>

            <AnimatePresence mode='wait'>
              <TabsContent value='catalogo' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Search */}
                  <motion.div 
                    className='mb-6'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className='relative max-w-md'>
                      <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
                      <Input
                        placeholder='Buscar servicios...'
                        className='pl-10'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </motion.div>

                  {/* Services Grid */}
                  <motion.div 
                    className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, staggerChildren: 0.05 }}
                  >
                    {filteredServices?.map((servicio, index) => (
                      <motion.div
                        key={servicio.servicioId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ y: -4 }}
                      >
                        <Card className='overflow-hidden group'>
                          <CardHeader className='pb-2'>
                            <div className='flex justify-between items-start gap-2'>
                              <CardTitle className='text-lg line-clamp-1'>
                                {servicio.nombre}
                              </CardTitle>
                              <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
                                <Link href={`/busy/servicios/update/${servicio.servicioId}`}>
                                  <Button variant='ghost' size='icon' className='h-8 w-8'>
                                    <Pencil className='h-4 w-4' />
                                  </Button>
                                </Link>
                                <Button 
                                  variant='ghost' 
                                  size='icon' 
                                  className='h-8 w-8'
                                  onClick={() => setServicioToDelete(servicio.servicioId)}
                                >
                                  <Trash2 className='h-4 w-4 text-destructive' />
                                </Button>
                              </div>
                            </div>
                            <CardDescription className='line-clamp-2 mt-1'>
                              {servicio.descripcion || 'Sin descripción'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className='pt-0'>
                            <Badge variant='outline' className='text-lg font-semibold px-3 py-1'>
                              {formatCurrency(servicio.precio)}
                            </Badge>
                          </CardContent>
                          <CardFooter className='bg-muted/50 pt-3 border-t'>
                            <motion.div className='w-full' whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button 
                                className='w-full bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg' 
                                onClick={() => addToCart(servicio)}
                              >
                                <ShoppingCart className='mr-2 h-4 w-4' /> Agregar al Carrito
                              </Button>
                            </motion.div>
                          </CardFooter>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>

                  {filteredServices?.length === 0 && (
                    <motion.div 
                      className='text-center py-16'
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className='inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4'>
                        <Package className='h-10 w-10 text-muted-foreground' />
                      </div>
                      <h3 className='text-xl font-semibold mb-2'>
                        No se encontraron servicios
                      </h3>
                      <p className='text-muted-foreground mb-4'>
                        Intenta con otro término de búsqueda o crea un nuevo servicio
                      </p>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button 
                          asChild
                          className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg'
                        >
                          <Link href='/busy/servicios/new'>
                            <Plus className='mr-2 h-4 w-4' /> Crear Servicio
                          </Link>
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </motion.div>
              </TabsContent>

              <TabsContent value='carrito' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className='text-center py-16'
                >
                  <div className='inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-6'>
                    <ShoppingCart className='h-12 w-12 text-green-600' />
                  </div>
                  <h3 className='text-2xl font-semibold mb-3'>
                    Gestiona tu carrito
                  </h3>
                  <p className='text-muted-foreground mb-6 max-w-md mx-auto'>
                    Haga clic en el botón "Carrito" para ver y gestionar los servicios agregados
                  </p>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className='inline-block'>
                    <Button 
                      onClick={() => setIsCartDialogOpen(true)}
                      disabled={cart.length === 0}
                      size='lg'
                      className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50'
                    >
                      <ShoppingCart className='mr-2 h-5 w-5' />
                      Abrir Carrito ({cart.length})
                    </Button>
                  </motion.div>
                </motion.div>
              </TabsContent>

              <TabsContent value='vendidos' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card>
                    <CardHeader>
                      <div className='flex items-center gap-3'>
                        <CheckCircle className='h-6 w-6 text-purple-600' />
                        <div>
                          <CardTitle>Historial de Ventas</CardTitle>
                          <CardDescription>Registro de todos los servicios vendidos</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <DataTable
                        columns={ventaColumns}
                        data={initialVentaServicios || []}
                        searchPlaceholder='Buscar ventas de servicios...'
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              <TabsContent value='recibidos' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card>
                    <CardHeader>
                      <div className='flex items-center gap-3'>
                        <Truck className='h-6 w-6 text-orange-600' />
                        <div>
                          <CardTitle>Servicios Recibidos</CardTitle>
                          <CardDescription>Registro de todos los servicios recibidos</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ServiciosRecibidosTable />
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </Tabs>

          {/* Delete Confirmation Dialog */}
          <AnimatePresence>
            {servicioToDelete && (
              <motion.div 
                className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setServicioToDelete(null)}
              >
                <motion.div 
                  className='bg-background p-6 rounded-lg max-w-md w-full shadow-2xl border'
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className='flex items-center gap-3 mb-4'>
                    <div className='p-3 bg-destructive/10 rounded-full'>
                      <Trash2 className='h-6 w-6 text-destructive' />
                    </div>
                    <h3 className='text-xl font-semibold'>
                      Confirmar eliminación
                    </h3>
                  </div>
                  <p className='text-muted-foreground mb-6'>
                    ¿Está seguro de que desea eliminar este servicio? Esta acción no se puede deshacer.
                  </p>
                  <div className='flex gap-3 justify-end'>
                    <Button 
                      variant='outline' 
                      onClick={() => setServicioToDelete(null)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant='destructive' 
                      onClick={handleDeleteServicio}
                    >
                      <Trash2 className='mr-2 h-4 w-4' />
                      Eliminar
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cart Component */}
          <ServiciosCart 
            cart={cart}
            setCart={setCart}
            isOpen={isCartDialogOpen}
            onOpenChange={setIsCartDialogOpen}
          />
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}