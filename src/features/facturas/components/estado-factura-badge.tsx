"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Factura } from "@/app/models/model"
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"

/**
 * @description Componente para mostrar el estado de una factura con colores y etiquetas
 * @param {Object} props - Props del componente
 * @param {Factura['estado']} props.estado - Estado de la factura
 * @param {string} [props.className] - Clases adicionales
 * @returns {JSX.Element} Badge con el estado de la factura
 */
export function EstadoFacturaBadge({ estado, className = "" }: { estado: Factura['estado'], className?: string }) {
  const config = {
    PENDIENTE: { 
      label: "Pendiente", 
      variant: "outline" as const, 
      className: "border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-600",
      icon: Clock
    },
    PAGADA: { 
      label: "Pagada", 
      variant: "default" as const, 
      className: "border-green-500 text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600",
      icon: CheckCircle
    },
    ANULADA: { 
      label: "Anulada", 
      variant: "secondary" as const, 
      className: "border-red-500 text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600",
      icon: XCircle
    },
    VENCIDA: { 
      label: "Vencida", 
      variant: "destructive" as const, 
      className: "border-orange-500 text-orange-700 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-600",
      icon: AlertCircle
    },
  }

  const { label, variant, className: stateClassName, icon: Icon } = config[estado]

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
    >
      <Badge variant={variant} className={`${stateClassName} ${className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    </motion.div>
  )
}
