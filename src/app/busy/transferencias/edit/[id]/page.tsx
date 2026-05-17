/**
 * @description Página de edición de Transferencia (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos de la transferencia a editar
 *
 * El formulario (TransferenciaForm) es un Client Component.
 */
import { getTransferenciaByIdAction } from "@/features/transferencias"
import { TransferenciaForm } from "@/features/transferencias/components/transferencias-form"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { LazyMotion, m as motion } from "framer-motion"
import { ArrowLeftRight, Sparkles } from "lucide-react"
import { notFound } from "next/navigation"


export const metadata = {
  title: "Editar Transferencia - FinanceTCP",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarTransferenciaPage({ params }: Props) {
  const { id: transferenciaId } = await params

  const result = await getTransferenciaByIdAction(transferenciaId)

  if (!result.success) {
    notFound()
  }

  const transferencia = result.data

  return (
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
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="h-3 w-3 text-yellow-300" />
              </motion.div>
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
  )
}