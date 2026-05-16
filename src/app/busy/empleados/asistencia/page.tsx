"use client";

import { motion } from "framer-motion";
import { EnhancedAsistenciaForm } from "@/features/empleados";
import { CalendarCheck, Clock, Users } from "lucide-react";

/**
 * Página de registro de asistencia de empleados con UI/UX mejorada
 * @returns Componente de página
 */
export default function AsistenciaPage() {
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
            <motion.h1 
              variants={itemVariants}
              className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent"
            >
              Control de Asistencia
            </motion.h1>
            <motion.p 
              variants={itemVariants}
              className="text-muted-foreground mt-2 text-lg"
            >
              Gestiona entradas, salidas y horarios del personal en tiempo real
            </motion.p>
          </div>
          
          <motion.div 
            variants={itemVariants}
            className="flex gap-3"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300 rounded-lg border border-orange-100 dark:border-orange-900">
              <Clock className="w-5 h-5" />
              <span className="font-medium">Tiempo Real</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300 rounded-lg border border-orange-100 dark:border-orange-900">
              <CalendarCheck className="w-5 h-5" />
              <span className="font-medium">Historial</span>
            </div>
          </motion.div>
        </div>

        <motion.div 
          variants={itemVariants}
          className="rounded-xl shadow-sm "
        >
          <EnhancedAsistenciaForm />
        </motion.div>
      </motion.div>
    </div>
  );
}
