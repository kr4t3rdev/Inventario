'use client'
import { DataTable } from "@/components/data-table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeleteClienteMutation, useGetClientesQuery } from "@/lib/redux/services/ClienteApi"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUp, ArrowUpDown, Pencil, Plus, Trash2, Users, Sparkles, UserCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

const Cliente = () => {

    const {data:cliente, isLoading} = useGetClientesQuery()

    const [clienteToDelete, setClienteToDelete] = useState<string | null>(null)
    const [ deleteCliente ] = useDeleteClienteMutation()

    const handleDelete = async () => {
      if (!clienteToDelete) return

      try {
        await deleteCliente(clienteToDelete).unwrap()
        toast("El cliente ha sido eliminado exitosamente.")
      } catch (error) {
        console.error("Error al eliminar el cliente:", error)
        toast("Hubo un error al eliminar el cliente.")
      } finally {
        setClienteToDelete(null)
      }
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: 'nombre',
            header: ({ column }) => (
                <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Nombre
                    <ArrowUp className='ml-2 h-4 w-4'/>
                </Button>
            ),
        },
        {
          accessorKey: 'direccion',
          header: ({ column }) => (
              <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                  Dirección
                  <ArrowUp className='ml-2 h-4 w-4'/>
              </Button>
          ),
      },
      {
        accessorKey: 'telefono',
        header: ({ column }) => (
            <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Teléfono
                <ArrowUp className='ml-2 h-4 w-4'/>
            </Button>
        ),
    },
    {
      accessorKey: 'numeroCuentaCUP',
      header: ({ column }) => (
          <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              Cuenta CUP
              <ArrowUp className='ml-2 h-4 w-4'/>
          </Button>
      ),
  },
  {
    accessorKey: 'numeroCuentaUSD',
    header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Cuenta USD
            <ArrowUp className='ml-2 h-4 w-4'/>
        </Button>
    ),
},
{
  accessorKey: 'numeroContrato',
  header: ({ column }) => (
      <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Contrato
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
                return <div className="text-center truncate max-w-[150px]">{date.toLocaleDateString()}</div>
            },
                },
                {
                  header: 'Acciones',
                    id:'actions',
                    cell:({ row }) => {
                        const cliente = row.original
                        return (
                            <div className="flex items-center gap-2">
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Link href={`/busy/cliente/update/${cliente.clienteId}`}>
                                  <Button variant='outline' className='h-8 w-8 p-0 cursor-pointer'>
                                      <Pencil className='h-4 w-4'/>
                                  </Button>
                              </Link>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                  onClick={() => setClienteToDelete(cliente.clienteId)}
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
                                <Skeleton className="h-8 w-32" />
                              </div>
                              <Skeleton className="h-10 w-32" />
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
                    <div>
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
                                className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                              >
                                <Users className="h-5 w-5 text-white" />
                              </motion.div>
                              <div className="relative">
                                <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                                  Clientes
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
                              <Button asChild className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                                  <Link href="/busy/cliente/new">
                                    <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
                                  </Link>
                                </Button>                        
                            </motion.div>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                          >
                            <DataTable
                              columns={columns}
                              data={cliente || []}
                              searchColumn="nombre"
                              searchPlaceholder="Buscar clientes..."
                            />
                          </motion.div>
                        </div>
                      </SidebarInset>
                    </SidebarProvider>
                                        
                   {/* Diálogo de confirmación para eliminar */}
                  <AlertDialog open={!!clienteToDelete} onOpenChange={(open) => !open && setClienteToDelete(null)}>
                  <AlertDialogContent className="border-dashed">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        >
                          <UserCircle className="h-5 w-5 text-destructive" />
                        </motion.div>
                        ¿Está seguro de eliminar este cliente?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. El cliente será eliminado permanentemente del sistema.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Eliminar Cliente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
                  )  
              }


export default Cliente
