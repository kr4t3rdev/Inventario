'use client'

/**
 * @description Componente de contenido para Editar Transferencia (Client Component).
 * Wrapper animado que evita que framer-motion se ejecute en el servidor.
 */

import { LazyMotion, m as motion } from "framer-motion"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ArrowLeftRight } from "lucide-react"
import { TransferenciaForm } from "@/features/transferencias/components/transferencias-form"

const loadFeatures = () => import("framer-motion").then((mod) => mod.domAnimation)

interface EditarTransferenciaContentProps {
  transferencia: Record<string, unknown>
}

export function EditarTransferenciaContent({ transferencia }: EditarTransferenciaContentProps) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <motion.div
              className="flex items-center gap-3 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="w-10 h-10 bg-linear-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg relative"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowLeftRight className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold">Editar Transferencia</h1>
                <p className="text-muted-foreground text-sm">
                  Modifique los datos de la transferencia
                </p>
              </div>
            </motion.div>
            <TransferenciaForm initialData={transferencia as any} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </LazyMotion>
  )
}
