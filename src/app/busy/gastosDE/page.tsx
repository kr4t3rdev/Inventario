'use client'
const DataTable = dynamic(() => import('@/components/data-table').then(mod => ({default: mod.DataTable})))
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeleteGastosDEMutation, useGetGastosDEQuery } from "@/lib/redux/services/gastosDEApi"
import { useGetVendorsQuery } from "@/lib/redux/services/vendorsApi"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUp, ArrowUpDown, Pencil, Plus, Trash2, Receipt, Sparkles, Loader2, AlertCircle } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { motion } from "framer-motion"

const GastosDE = () => {

    const {data:gastosDE, isLoading} = useGetGastosDEQuery()
    const {data: vendors} = useGetVendorsQuery()

    const [gastosDEToDelete, setGastosDEToDelete] = useState<string | null>(null)
    const [ filterProveedor, setFilterProveedor ] = useState<string>('')
    const [ deleteGastosDE ] = useDeleteGastosDEMutation()

    const filteredGastosDE = gastosDE?.filter((gasto: any) => {
        if (filterProveedor && gasto.proveedor !== filterProveedor) return false
        return true
    }) || []

    const handleDelete = async () => {
      if (!gastosDEToDelete) return
      try {
        await deleteGastosDE(gastosDEToDelete).unwrap()
        toast("El gasto de explotación ha sido eliminado exitosamente.")
      } catch (error) {
        console.error("Error al eliminar el gasto de explotación:", error)
        toast("Hubo un error al eliminar el gasto de explotación.")
      } finally {
        setGastosDEToDelete(null)
      }
    }

    const columns: ColumnDef<unknown>[] = [
        {
            accessorKey: 'tipo',
            header: ({ column }) => (
                <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Tipo
                    <ArrowUp className='ml-2 h-4 w-4'/>
                </Button>
            ),
        },
        {
            accessorKey: 'proveedor',
            header: ({ column }) => (
                <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Proveedor
                    <ArrowUp className='ml-2 h-4 w-4'/>
                </Button>
            ),
        },
        {
            accessorKey: 'descripcion',
            header: ({ column }) => (
                <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Descripción
                    <ArrowUp className='ml-2 h-4 w-4'/>
                </Button>
            ),
        },
        {
            accessorKey: 'monto',
            header: ({ column }) => (
                <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Monto
                    <ArrowUp className='ml-2 h-4 w-4'/>
                </Button>
            ),
            cell: ({ row }) => {
              const monto = (row.original as any).monto
              return (
                <motion.div
                  key={monto}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="font-medium"
                >
                  ${monto?.toFixed(2) || '0.00'}
                </motion.div>
              )
            }
        },
        {
            accessorKey: 'periodo',
            header: ({ column }) => (
                <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Período
                    <ArrowUp className='ml-2 h-4 w-4'/>
                </Button>
            ),
        },   
        {
                    accessorKey:'createdAt',
                    header: ({column}) => (
                        <Button variant='ghost' onClick={ () => column.toggleSorting(column.getIsSorted() === 'asc')}>
                            Fecha de creacion
                            <ArrowUpDown className='ml-2 h-4 w-4'/>
                        </Button>
                    ),
                    cell: ({row}) => {
                        const date = new Date(row.getValue('createdAt'))
                        return <div className="max-w-[150px] truncate text-center">{date.toLocaleDateString()}</div>
                    },
                },
                {
                  header: 'Acciones',
                    id:'actions',
                    cell:({ row }) => {
                        const gastoDE = row.original as any
                        return (
                            <div className="flex items-center gap-2">
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Link href={`/busy/gastosDE/update/${gastoDE.gastosDEId}`}>
                                  <Button variant='outline' className='h-8 w-8 p-0 cursor-pointer'>
                                      <Pencil className='h-4 w-4'/>
                                  </Button>
                              </Link>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                  onClick={() => setGastosDEToDelete(gastoDE.gastosDEId)}
                                  variant='outline'
                                  className='h-8 w-8 p-0 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors'
                              >
                                  <Trash2 className='h-4 w-4'/>
                              </Button>
                            </motion.div>
                            </div>
                             )
                    }
                }
            ]
            if (isLoading) {
                    return (
                      <SidebarProvider>           
                        <SidebarInset>              
                          <div className="container mx-auto py-4">
                            <motion.div 
                              className="flex justify-between items-center mb-6"
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5 }}
                            >
                              <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-xl" />
                                <Skeleton className="h-8 w-48" />
                              </div>
                              <Skeleton className="h-10 w-48" />
                            </motion.div>
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                            >
                              <div className="flex items-center justify-center py-12 mb-6">
                                <motion.div
                                  className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                />
                              </div>
                              <div className="space-y-3">
                                {[...Array(8)].map((_, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                  >
                                    <Skeleton className="h-12 w-full" />
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          </div>
                        </SidebarInset>
                      </SidebarProvider>
                    )
                  }  
                  return (
                    <SidebarProvider>          
                      <SidebarInset>            
                        <div className="container mx-auto py-4">
                          <motion.div 
                            className="flex justify-between items-center mb-6"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                          >
                            <motion.div 
                              className="flex items-center gap-3"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 }}
                            >
                              <motion.div 
                                className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                              >
                                <Receipt className="h-5 w-5 text-white" />
                              </motion.div>
                              <div className="relative">
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                                  Gasto de Explotación
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
                            <motion.div
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 }}
                            >
                              <Button asChild className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                                  <Link href="/busy/gastosDE/new">
                                    <Plus className="mr-2 h-4 w-4" /> Nuevo Gasto de Explotación
                                  </Link>
                                </Button>                        
                            </motion.div>
                          </motion.div>
                           <motion.div
                             initial={{ opacity: 0, y: 20 }}
                             animate={{ opacity: 1, y: 0 }}
                             transition={{ duration: 0.5, delay: 0.3 }}
                           >
                             <div className="flex gap-4 mb-4">
                               <select
                                 value={filterProveedor}
                                 onChange={(e) => setFilterProveedor(e.target.value)}
                                 className="h-10 rounded-md border border-slate-200 dark:border-orange-900/20 bg-slate-50 dark:bg-slate-900/10 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                               >
                                 <option value="">Todos los proveedores</option>
                                 {Array.from(new Set(gastosDE?.map((g: any) => g.proveedor))).map((proveedor: any) => (
                                   proveedor && (
                                     <option key={proveedor} value={proveedor}>
                                       {proveedor}
                                     </option>
                                   )
                                 ))}
                               </select>
                             </div>
                             <DataTable
                               columns={columns}
                               data={filteredGastosDE}
                               searchColumn="tipo"
                               searchPlaceholder="Buscar gastos de explotación..."
                             />
                           </motion.div>
                        </div>
                      </SidebarInset>

                      {/* Diálogo de confirmación para eliminar */}
                      <AlertDialog open={!!gastosDEToDelete} onOpenChange={(open) => !open && setGastosDEToDelete(null)}>
                        <AlertDialogContent className="border-dashed">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                              >
                                <AlertCircle className="h-5 w-5 text-destructive" />
                              </motion.div>
                              ¿Está seguro?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Esto eliminará permanentemente el gasto de explotación.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </SidebarProvider>
                  )  
              }


export default GastosDE
