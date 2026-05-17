"use client"

/**
 * @description Header animado para páginas de clientes (se usa en Server Components).
 * @param {Object} props
 * @param {string} props.title - Título de la página
 * @param {string} props.description - Descripción de la página
 * @returns {JSX.Element} Header con icono naranja animado
 */
import { motion } from "framer-motion"
import { UserCircle, Sparkles } from "lucide-react"

interface ClientesPageHeaderProps {
  title: string
  description: string
}

export function ClientesPageHeader({ title, description }: ClientesPageHeaderProps) {
  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-3">
        <motion.div
          className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <UserCircle className="h-5 w-5 text-white" />
        </motion.div>
        <div className="relative">
          <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
            {title}
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
      </div>
      <motion.p
        className="text-muted-foreground ml-13 mt-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {description}
      </motion.p>
    </motion.div>
  )
}
