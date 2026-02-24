"use client"

import { MiEmpresaForm } from "@/components/mi-empresa/mi-empresa-form"
import { motion } from "framer-motion"

export default function MiEmpresaConfigPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="container mx-auto p-6 space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Mi Empresa</h1>
        <p className="text-muted-foreground">Configura los datos que aparecen como beneficiario en facturas y documentos</p>
      </motion.div>
      <MiEmpresaForm />
    </motion.div>
  )
}

