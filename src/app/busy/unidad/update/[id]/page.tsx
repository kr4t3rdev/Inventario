"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { UnidadForm, getUnidadByIdAction } from "@/features/unidades"
import { motion } from "framer-motion"
import { Scale, AlertCircle, Sparkles, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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

// Pulse skeleton
function PulseSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  )
}

export default function UpdateUnidadPage() {
  const params = useParams()
  const unidadId = params.id as string
  const [unidad, setUnidad] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      setError(false)
      const result = await getUnidadByIdAction(unidadId)
      if (result.success) {
        setUnidad(result.data!)
      } else {
        setError(true)
      }
      setIsLoading(false)
    }
    fetchData()
  }, [unidadId])

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <motion.div 
            className="container mx-auto py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className="mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <PulseSkeleton className="h-12 w-12 rounded-xl" />
                <div>
                  <PulseSkeleton className="h-8 w-48 mb-2" />
                  <PulseSkeleton className="h-4 w-64" />
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex flex-col items-center justify-center py-12 gap-4 bg-muted/30 dark:bg-muted/10 rounded-lg border-2 border-dashed">
                <LoadingSpinner size={40} />
                <span className="text-muted-foreground">Cargando unidad...</span>
              </div>
            </motion.div>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error || !unidad) {
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
                className="w-12 h-12 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Scale className="h-6 w-6 text-white" />
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                </motion.div>
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Editar Unidad
                </h1>
                <p className="text-muted-foreground">
                  Modifique los datos de <span className="font-semibold text-primary">{unidades.nombre}</span>
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
