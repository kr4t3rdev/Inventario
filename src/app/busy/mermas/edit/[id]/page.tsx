/**
 * @description Página de edición de Merma (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos de la merma a editar
 *
 * El formulario (MermaForm) es un Client Component.
 */
import { getMermaByIdAction } from "@/features/mermas"
import { MermaForm } from "@/features/mermas"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"
import { AlertTriangle, Sparkles, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { notFound } from "next/navigation"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarMermaPage({ params }: Props) {
  const { id: mermaId } = await params

  const result = await getMermaByIdAction(mermaId)

  if (!result.success) {
    notFound()
  }

  const merma = result.data

  return (
    <SidebarProvider>      
      <SidebarInset>        
        <div className="container mx-auto py-4">
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href="/busy/mermas">
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
              <motion.div 
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <motion.div 
                  className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <AlertTriangle className="h-5 w-5 text-white" />
                </motion.div>
                <div className="relative">
                  <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                    Editar Merma
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
            </div>
            <motion.p 
              className="text-muted-foreground ml-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Modifique los datos de la merma
            </motion.p>
          </motion.div>
  // @ts-expect-error
  // @ts-expect-error
  // @ts-expect-error
          <MermaForm initialData={{ ...merma, motivo: merma.motivo ?? "" }} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}