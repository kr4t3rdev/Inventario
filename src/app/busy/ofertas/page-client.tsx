"use client"

/**
 * @description Client Component para la página de ofertas con animaciones framer-motion
 * @module app/busy/ofertas/page-client
 */

import Link from "next/link"
import { OfertasTable } from "@/features/ofertas/components/ofertas-table"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { PlusCircle, Tag, Sparkles } from "lucide-react"
import { LazyMotion, m as motion } from "framer-motion"
import type { Oferta } from "@/app/models/model"

/**
 * @description Props del componente OfertasPageContent
 * @param {Object} props - Props del componente
 * @param {Oferta[]} props.ofertas - Lista de ofertas
 */
interface OfertasPageContentProps {
  ofertas: Oferta[]
}

/**
 * @description Contenido de la página de ofertas con animaciones
 * @param {OfertasPageContentProps} props - Props del componente
 * @returns {JSX.Element} Página de ofertas animada
 */
export function OfertasPageContent({ ofertas }: OfertasPageContentProps) {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          {/* Header */}
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
                className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Tag className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                  Ofertas
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
              <Button
                asChild
                className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90"
              >
                <Link href="/busy/ofertas/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Oferta
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <OfertasTable
              ofertas={ofertas}
              isLoading={false}
              error={null}
            />
          </motion.div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
