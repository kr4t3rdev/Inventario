"use client";

import { motion } from "framer-motion";
import { VacacionesForm } from "@/features/empleados";
import { Calendar, Palmtree, Sun } from "lucide-react";

/**
 * Página de gestión de vacaciones de empleados con UI/UX mejorada
 * @returns Componente de página
 */
export default function VacacionesPage() {
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <motion.div variants={itemVariants} className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                <Palmtree className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                Gestión de Vacaciones
              </h1>
            </motion.div>
            <motion.p 
              variants={itemVariants}
              className="text-muted-foreground mt-2 text-lg"
            >
              Administra solicitudes y saldos de vacaciones de tu equipo
            </motion.p>
          </div>
          
          <motion.div 
            variants={itemVariants}
            className="flex gap-3"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-slate-900/10 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-100 dark:border-amber-900">
              <Sun className="w-5 h-5" />
              <span className="font-medium">Planificación</span>
            </div>
          </motion.div>
        </div>

        <motion.div 
          variants={itemVariants}
          className="rounded-xl shadow-sm border border-border/10 "
        >
          <VacacionesForm />
        </motion.div>
      </motion.div>
    </div>
  );
}
