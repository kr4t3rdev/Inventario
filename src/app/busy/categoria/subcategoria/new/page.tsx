"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SubcategoryForm } from "@/features/categorias";

/**
 * @description Página para crear una nueva subcategoría CLAS en modo EAN-13.
 * @returns {ReactElement} Vista de creación de subcategorías CLAS.
 */
export default function NuevaSubcategoriaPage(): ReactElement {
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
              <Link href="/busy/categoria">
                <Button variant="outline" className="mb-4 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver a Categorías
                </Button>
              </Link>
            </motion.div>

            <div className="flex items-center gap-3 mb-2">
              <motion.div
                className="w-12 h-12 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Sparkles className="h-6 w-6 text-white" />
                <motion.div
                  animate={{
                    rotate: 360,
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                </motion.div>
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Nueva Subcategoría CLAS
                </h1>
                <p className="text-muted-foreground">
                  Selecciona la sección CLAS y luego el específico que deseas registrar.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <SubcategoryForm />
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  );
}
