"use client"

/**
 * @description Header animado para páginas de clientes (se usa en Server Components).
 * @param {Object} props
 * @param {string} props.title - Título de la página
 * @param {string} props.description - Descripción de la página
 * @returns {JSX.Element} Header con icono naranja animado
 */
import { motion, useReducedMotion } from "framer-motion"
import { UserCircle } from "lucide-react"
import { ManagementPageTitle } from "@/components/management-page-title"

interface ClientesPageHeaderProps {
  title: string
  description: string
}

export function ClientesPageHeader({ title, description }: ClientesPageHeaderProps) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <ManagementPageTitle icon={UserCircle} title={title} description={description} />
    </motion.div>
  )
}
