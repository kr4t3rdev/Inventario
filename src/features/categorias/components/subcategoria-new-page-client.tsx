"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { LazyMotion, m as motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SubcategoryForm } from "@/features/categorias/components/subcategory-form";
import { useAuth } from "@/contexts/auth-context";
import { fetchMiEmpresaSettings } from "@/features/mi-empresa/lib/client-mi-empresa";

/**
 * @description Componente cliente para la página de creación de subcategorías.
 * Encapsula el layout animado, la sidebar y el formulario interactivo.
 * El formulario interno decide si opera en modo jerárquico normal o CLAS/EAN-13.
 *
 * @returns {ReactElement} Vista completa de creación de subcategorías.
 */
export function SubcategoriaNewPageClient(): ReactElement {
  const { user } = useAuth();
  const [usaEan13, setUsaEan13] = useState(false);
  const categoriasEan13Habilitado =
    user?.role === 'admin' || user?.planFeatures?.['categorias-ean13'] === true;

  useEffect(() => {
    fetchMiEmpresaSettings(() => setUsaEan13(false))
      .then((r) => {
        if (r.success) {
          setUsaEan13(
            categoriasEan13Habilitado && r.data?.usaCodigoEan13 === true,
          );
        } else {
          setUsaEan13(false);
        }
      })
      .catch(() => setUsaEan13(false));
  }, [categoriasEan13Habilitado]);

  const title = usaEan13 ? 'Nuevo Específico CLAS' : 'Nueva Subcategoría';
  const description = usaEan13
    ? 'Selecciona la sección CLAS y luego el específico que deseas registrar dentro de la taxonomía EAN-13.'
    : 'Crea una subcategoría nueva dentro de una categoría existente.';

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
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  {title}
                </h1>
                <p className="text-muted-foreground">
                  {description}
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
