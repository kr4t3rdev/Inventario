"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { PtoVentaForm } from "@/features/puntos-venta/components/pvtoVenta-form"
import { LazyMotion, m as motion } from "framer-motion"
import { Store, AlertCircle, Sparkles, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface PvEditPageClientProps {
  puntoVenta: {
    pvId: string
    nombre: string
    ubicacion: string
    stockPuntoVenta?: number
    listaPrecioId?: string | null
  } | null
}

/**
 * @description Componente cliente para la página de edición de puntos de venta.
 * @param {PvEditPageClientProps} props - Datos del punto de venta a editar.
 * @returns {JSX.Element} Vista de edición.
 */
export function EditarPvPageClient({ puntoVenta }: PvEditPageClientProps) {
  if (!puntoVenta) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <motion.div 
            className="container mx-auto py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Alert variant="destructive" className="max-w-lg">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Error al cargar el punto de venta</AlertTitle>
                <AlertDescription>
                  No se pudo cargar la información del punto de venta.
                </AlertDescription>
              </Alert>
            </motion.div>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <motion.div 
          className="container mx-auto py-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
              <Link href="/busy/puntosDeVenta">
                <Button variant="outline" className="mb-4 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver a Puntos de Venta
                </Button>
              </Link>
            </motion.div>
            <div className="flex items-center gap-3 mb-2">
              <motion.div 
                className="w-12 h-12 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Store className="h-6 w-6 text-white" />
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                  transition={{ rotate: { duration: 20, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                </motion.div>
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Editar Punto de Venta
                </h1>
                <p className="text-muted-foreground">
                  Modifique los datos de <span className="font-semibold text-primary">{puntoVenta.nombre}</span>
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <PtoVentaForm initialData={puntoVenta} />
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
