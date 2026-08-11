"use client"

import dynamic from "next/dynamic"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { deleteCategoriaAction } from "@/features/categorias/actions"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ArrowUp,
  ArrowUpDown,
  Pencil,
  Plus,
  Trash2,
  TreePine,
  Folder,
  FolderOpen,
  Layers,
  Grid3X3
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Categoria, CategoriaHierarchy } from "@/app/models/model"
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import { fetchMiEmpresaSettings } from "@/features/mi-empresa/lib/client-mi-empresa"

interface CategoriaPageClientProps {
  categorias: Categoria[]
  hierarchy: CategoriaHierarchy[]
}

// Loading spinner component
function LoadingSpinner({ size = 32 }: { size?: number }) {
  return (
    <motion.div
      className="border-4 border-primary border-t-transparent rounded-full"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  )
}

// Lazy load heavy components
const DataTable = dynamic(() => import("@/components/data-table").then(mod => ({ default: mod.DataTable })), {
  loading: () => (
    <motion.div
      className="h-125 w-full flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size={40} />
        <span className="text-muted-foreground">Cargando tabla de categorías...</span>
      </div>
    </motion.div>
  )
})

/**
 * @description Componente cliente de la página de categorías.
 * Recibe datos iniciales desde el Server Component y maneja
 * la interactividad: toggle de vista (lista/árbol), eliminación
 * de categorías, y animaciones con Framer Motion.
 *
 * @param {CategoriaPageClientProps} props - Datos iniciales de categorías.
 * @returns {JSX.Element} Vista completa de gestión de categorías.
 */
export function CategoriaPageClient({ categorias: initialCategorias, hierarchy: initialHierarchy }: CategoriaPageClientProps) {
  const { user } = useAuth()
  const [categorias, setCategorias] = useState<Categoria[]>(initialCategorias)
  const [categoriaHierarchy, setCategoriaHierarchy] = useState<CategoriaHierarchy[]>(initialHierarchy)
  const [showTreeView, setShowTreeView] = useState(false)
  const [categoriaToDelete, setCategoriaToDelete] = useState<string | null>(null)
  const [usaEan13, setUsaEan13] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const categoriasEan13Habilitado =
    user?.role === 'admin' || user?.planFeatures?.['categorias-ean13'] === true
  const categoryCtaLabel = usaEan13 ? 'Nueva Sección CLAS' : 'Nueva Categoría'
  const subcategoryCtaLabel = usaEan13 ? 'Nuevo Específico CLAS' : 'Nueva Subcategoría'

  // Sync state when server re-fetches (e.g., after router.refresh())
  useEffect(() => {
    setCategorias(initialCategorias)
    setCategoriaHierarchy(initialHierarchy)
  }, [initialCategorias, initialHierarchy])

  useEffect(() => {
    fetchMiEmpresaSettings(() => setUsaEan13(false))
      .then((r) => {
        if (r.success) {
          setUsaEan13(
            categoriasEan13Habilitado && r.data?.usaCodigoEan13 === true,
          )
        } else {
          setUsaEan13(false)
        }
      })
      .catch(() => setUsaEan13(false))
  }, [categoriasEan13Habilitado])

  const handleDelete = () => {
    if (!categoriaToDelete) return
    startTransition(async () => {
      const r = await deleteCategoriaAction(categoriaToDelete)
      if (r.success) {
        toast.success("Categoría eliminada exitosamente")
        router.refresh()
      } else {
        toast.error(r.error?.message || "Error al eliminar")
      }
      setCategoriaToDelete(null)
    })
  }

  // Flat table columns for regular view
  const flatColumns: ColumnDef<Categoria>[] = [
    {
      accessorKey: 'nombre',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Nombre
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const categoria = row.original
        const hasSubcategorias = categoria.subcategorias && categoria.subcategorias.length > 0
        return (
          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              {hasSubcategorias ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 text-gray-500" />
              )}
            </motion.div>
            <span>{categoria.nombre}</span>
            {hasSubcategorias && categoria.subcategorias && (
              <Badge variant="secondary" className="text-xs">
                {usaEan13 ? `${categoria.subcategorias.length} específicos CLAS` : `${categoria.subcategorias.length} subcategorías`}
              </Badge>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: 'parent',
      header: 'Categoría Padre',
      cell: ({ row }) => {
        const categoria = row.original
        return categoria.parent ? (
          <Badge variant="outline">{categoria.parent.nombre}</Badge>
        ) : (
          <span className="text-muted-foreground">Categoría principal</span>
        )
      }
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Fecha de creación
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'))
        return <div className="max-w-37.5 truncate text-center">{date.toLocaleDateString()}</div>
      },
    },
    {
      header: 'Acciones',
      id: 'actions',
      cell: ({ row }) => {
        const categoria = row.original
        return (
          <div className="flex items-center gap-2">
            <Link href={`/busy/categoria/update/${categoria.catId}`}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Button variant='outline' className='h-8 w-8 p-0 cursor-pointer' aria-label="Editar categoría">
                  <Pencil className='h-4 w-4' />
                </Button>
              </motion.div>
            </Link>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setCategoriaToDelete(categoria.catId)}
                variant='outline'
                className='h-8 w-8 p-0 cursor-pointer'
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </motion.div>
          </div>
        )
      }
    }
  ]

  // Tree view columns for hierarchical display
  const treeColumns: ColumnDef<CategoriaHierarchy>[] = [
    {
      accessorKey: 'nombre',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          <TreePine className='mr-2 h-4 w-4' />
          Jerarquía de Categorías
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const categoria = row.original
        const indent = categoria.level * 20
        return (
          <motion.div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${indent}px` }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: row.index * 0.03 }}
          >
            {categoria.level === 0 ? (
              <FolderOpen className="h-4 w-4 text-blue-600" />
            ) : (
              <Folder className="h-4 w-4 text-gray-500" />
            )}
            <span className={categoria.level === 0 ? "font-semibold" : ""}>{categoria.nombre}</span>
            {categoria.subcategorias.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {categoria.subcategorias.length}
              </Badge>
            )}
          </motion.div>
        )
      }
    },
    {
      accessorKey: 'productCount',
      header: 'Productos',
      cell: ({ row }) => {
        const count = row.original.productCount
        return (
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            <Badge variant={count > 0 ? "default" : "secondary"}>
              {count} productos
            </Badge>
          </motion.div>
        )
      }
    },
    {
      header: 'Acciones',
      id: 'actions',
      cell: ({ row }) => {
        const categoria = row.original
        return (
          <div className="flex items-center gap-2">
            <Link href={`/busy/categoria/update/${categoria.catId}`}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Button variant='outline' className='h-8 w-8 p-0 cursor-pointer' aria-label="Editar categoría">
                  <Pencil className='h-4 w-4' />
                </Button>
              </motion.div>
            </Link>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setCategoriaToDelete(categoria.catId)}
                variant='outline'
                className='h-8 w-8 p-0 cursor-pointer'
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </motion.div>
          </div>
        )
      }
    }
  ]

  // Flatten hierarchy for tree view display
  const flattenHierarchy = (categories: CategoriaHierarchy[]): CategoriaHierarchy[] => {
    const result: CategoriaHierarchy[] = []

    const flatten = (cats: CategoriaHierarchy[]) => {
      cats.forEach(cat => {
        result.push(cat)
        if (cat.subcategorias && cat.subcategorias.length > 0) {
          flatten(cat.subcategorias)
        }
      })
    }

    flatten(categories)
    return result
  }

  const displayData = showTreeView
    ? flattenHierarchy(categoriaHierarchy || [])
    : categorias || []

  const displayColumns = showTreeView ? treeColumns : flatColumns

  return (
    <>
      <SidebarProvider>
        <SidebarInset>
          <motion.div
            className="container mx-auto py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Header Section */}
            <motion.div
              className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-10 h-10 bg-linear-to-br from-primary to-purple rounded-xl flex items-center justify-center shadow-lg relative"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Layers className="h-5 w-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Categorías
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Gestiona la jerarquía de categorías de productos
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-4'>
                {/* View Toggle */}
                <motion.div
                  className="flex items-center gap-3 bg-muted/50 rounded-lg p-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <motion.button
                    onClick={() => setShowTreeView(false)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 ${
                      !showTreeView ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Grid3X3 className="h-4 w-4" />
                    <span className="text-sm font-medium">Lista</span>
                  </motion.button>
                  <motion.button
                    onClick={() => setShowTreeView(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 ${
                      showTreeView ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <TreePine className="h-4 w-4" />
                    <span className="text-sm font-medium">Árbol</span>
                  </motion.button>
                </motion.div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Button
                      asChild
                      className="gap-2 bg-linear-to-r from-primary to-purple hover:from-primary/90 hover:to-purple/90"
                    >
                      <Link href="/busy/categoria/new">
                        <Plus className="h-4 w-4" />
                        {categoryCtaLabel}
                      </Link>
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    <Button
                      asChild
                      variant="outline"
                      className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <Link href="/busy/categoria/subcategoria/new">
                        <Layers className="h-4 w-4" />
                        {subcategoryCtaLabel}
                      </Link>
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Data Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={showTreeView ? 'tree' : 'flat'}
                  initial={{ opacity: 0, x: showTreeView ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: showTreeView ? -20 : 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <DataTable
                    columns={displayColumns as any}
                    data={displayData as any}
                    searchColumn="nombre"
                    searchPlaceholder={showTreeView ? "Buscar en jerarquía..." : "Buscar categorías..."}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!categoriaToDelete} onOpenChange={(open) => !open && setCategoriaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la categoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
