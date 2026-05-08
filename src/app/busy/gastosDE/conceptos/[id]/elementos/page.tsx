'use client'
const DataTable = dynamic(() => import('@/components/data-table').then(mod => ({default: mod.DataTable})))
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { getGastoConceptoByIdAction, getGastoElementosAction, deleteGastoElementoAction } from "@/features/gastosDE"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUp, ArrowLeft, ArrowUpDown, Layers, Plus, Trash2, Pencil, Sparkles, AlertCircle } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { motion } from "framer-motion"

const GastoElementos = () => {
    const params = useParams()
    const conceptoId = params.id as string
    const [elementoToDelete, setElementoToDelete] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [concepto, setConcepto] = useState<any>(null)
    const [elementos, setElementos] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => { async function f() { setIsLoading(true); const r=await getGastoConceptoByIdAction(conceptoId); if(r.success) setConcepto(r.data!); const r2=await getGastoElementosAction(conceptoId); if(r2.success) setElementos(r2.data??[]); setIsLoading(false); } f(); }, [conceptoId])

    const handleDelete = async () => {
      if (!elementoToDelete) return
      startTransition(async () => {
        const r=await deleteGastoElementoAction(elementoToDelete)
        if(r.success) { toast.success(r.data?.message||"Eliminado"); const ref=await getGastoElementosAction(conceptoId); if(ref.success) setElementos(ref.data??[]) }
        else toast.error(r.error?.message||"Error al eliminar")
        setElementoToDelete(null)
      })
    }
    }

    const columns: ColumnDef<unknown>[] = [
        {
            accessorKey: 'nombre',
            header: ({ column }) => (
                <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Elemento de Gasto
                    <ArrowUp className='ml-2 h-4 w-4'/>
                </Button>
            ),
        },
        {
            accessorKey: 'descripcion',
            header: 'Descripción',
            cell: ({ row }) => {
                const desc = (row.original as any).descripcion
                return <div className="max-w-[300px] truncate text-muted-foreground">{desc || "—"}</div>
            },
        },
        {
            accessorKey: '_count.gastosDE',
            header: 'Gastos',
            cell: ({ row }) => {
                const count = (row.original as any)._count?.gastosDE || 0
                return <Badge variant="outline">{count}</Badge>
            },
        },
        {
            accessorKey: 'isActive',
            header: ({ column }) => (
                <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Estado
                    <ArrowUp className='ml-2 h-4 w-4'/>
                </Button>
            ),
            cell: ({ row }) => {
                const isActive = (row.original as any).isActive
                return isActive ? (
                    <Badge className="bg-green-600 text-white">Activo</Badge>
                ) : (
                    <Badge className="bg-gray-600 text-white">Inactivo</Badge>
                )
            },
        },
        {
            header: 'Acciones',
            id: 'actions',
            cell: ({ row }) => {
                const elemento = row.original as any
                return (
                    <div className="flex items-center gap-2">
                        <Link href={`/busy/gastosDE/conceptos/${conceptoId}/elementos/update/${elemento.elementoId}`}>
                            <Button variant='outline' className='h-8 w-8 p-0 cursor-pointer'>
                                <Pencil className='h-4 w-4'/>
                            </Button>
                        </Link>
                        <Button
                            onClick={() => setElementoToDelete(elemento.elementoId)}
                            variant='outline'
                            className='h-8 w-8 p-0 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors'
                        >
                            <Trash2 className='h-4 w-4'/>
                        </Button>
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
                        <div className="flex items-center gap-3 mb-6">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <Skeleton className="h-8 w-48" />
                        </div>
                        <div className="space-y-3">
                            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        )
    }

    if (!concepto) {
        return (
            <SidebarProvider>
                <SidebarInset>
                    <div className="container mx-auto py-4">
                        <p className="text-muted-foreground">Concepto no encontrado.</p>
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
                        <motion.div className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                            <Button variant="ghost" asChild className="gap-2">
                                <Link href="/busy/gastosDE/conceptos">
                                    <ArrowLeft className="h-4 w-4" /> Conceptos
                                </Link>
                            </Button>
                            <motion.div
                                className="w-10 h-10 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg"
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            >
                                <Layers className="h-5 w-5 text-white" />
                            </motion.div>
                            <div className="relative">
                                <h1 className="text-2xl font-bold bg-linear-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                                    Elementos: {concepto.nombre}
                                </h1>
                                <motion.div className="absolute -right-4 -top-1" animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ rotate: { duration: 20, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}>
                                    <Sparkles className="h-4 w-4 text-yellow-500" />
                                </motion.div>
                            </div>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                            <Button asChild className="bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-500/90 hover:to-indigo-600/90">
                                <Link href={`/busy/gastosDE/conceptos/${conceptoId}/elementos/new`}>
                                    <Plus className="mr-2 h-4 w-4" /> Nuevo Elemento
                                </Link>
                            </Button>
                        </motion.div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                        <DataTable
                            columns={columns}
                            data={elementos || []}
                            searchColumn="nombre"
                            searchPlaceholder="Buscar elementos de gastos..."
                        />
                    </motion.div>
                </div>
            </SidebarInset>

            <AlertDialog open={!!elementoToDelete} onOpenChange={(open) => !open && setElementoToDelete(null)}>
                <AlertDialogContent className="border-dashed">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            ¿Está seguro?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará el elemento. Los gastos asociados quedarán sin elemento.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SidebarProvider>
    )
}

export default GastoElementos
