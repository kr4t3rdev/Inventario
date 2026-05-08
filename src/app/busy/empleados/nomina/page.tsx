"use client";

import { motion } from "framer-motion";
import { NominaView } from "@/features/empleados";
import { Banknote, Calculator, Wallet } from "lucide-react";

/**
 * Página de gestión de nómina de empleados con UI/UX mejorada
 * @returns Componente de página
 */
export default function NominaPage() {
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
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Banknote className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                Gestión de Nómina
              </h1>
            </motion.div>
            <motion.p 
              variants={itemVariants}
              className="text-muted-foreground mt-2 text-lg"
            >
              Cálculo automatizado, control de pagos y análisis salarial
            </motion.p>
          </div>
          
          <motion.div 
            variants={itemVariants}
            className="flex gap-3"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 rounded-lg border border-teal-100 dark:border-teal-900">
              <Wallet className="w-5 h-5" />
              <span className="font-medium">Pagos</span>
            </div>
          </motion.div>
        </div>

        <motion.div 
          variants={itemVariants}
          className="bg-card rounded-xl shadow-sm border border-border/50"
        >
          <NominaView />
        </motion.div>
      </motion.div>
    </div>
  );
}
