"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { UnidadForm } from "@/features/unidades/components/unidad-form"
import { LazyMotion, m as motion } from "framer-motion"
import { Scale, AlertCircle, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface UnidadEditPageClientProps {
  unidad: {
    unidadId: string
    nombre: string
    simbolo: string
  } | null
}

/**
 * @description Componente cliente para la página de edición de unidades.
 * @param {UnidadEditPageClientProps} props - Datos de la unidad a editar.
 * @returns {JSX.Element} Vista de edición de unidad.
 */
export function EditarUnidadPageClient({ unidad }: UnidadEditPageClientProps) {
  if (!unidad) {
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
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Link href="/busy/unidad">
                <Button variant="outline" className="mb-4 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver a Unidades
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Alert variant="destructive" className="max-w-lg">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Error al cargar la unidad</AlertTitle>
                <AlertDescription>
                  No se pudo cargar la información de la unidad. Por favor, intenta nuevamente.
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
          {/* Header */}
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Link href="/busy/unidad">
                <Button variant="outline" className="mb-4 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver a Unidades
                </Button>
              </Link>
            </motion.div>

            <div className="flex items-center gap-3 mb-2">
              <motion.div 
                className="w-12 h-12 bg-linear-to-br from-primary to-purple rounded-xl flex items-center justify-center shadow-lg relative"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Scale className="h-6 w-6 text-white" />

              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Editar Unidad
                </h1>
                <p className="text-muted-foreground">
                  Modifique los datos de <span className="font-semibold text-primary">{unidad.nombre}</span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <UnidadForm initialData={unidad} />
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
