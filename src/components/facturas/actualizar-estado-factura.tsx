"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUpdateFacturaMutation } from "@/lib/redux/services/facturasApi"
import { EstadoFacturaBadge } from "./estado-factura-badge"
import { Factura } from "@/app/models/model"
import { toast } from "sonner"
import { Loader2, ChevronDown, RefreshCw } from "lucide-react"

/**
 * @description Componente para actualizar el estado de una factura con dropdown
 * @param {Object} props - Props del componente
 * @param {Factura} props.factura - Factura a actualizar
 * @param {boolean} [props.showLabel=true] - Mostrar etiqueta del estado actual
 * @returns {JSX.Element} Dropdown para cambiar el estado de la factura
 */
export function ActualizarEstadoFactura({ factura, showLabel = true }: { factura: Factura, showLabel?: boolean }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [updateFactura] = useUpdateFacturaMutation()

  const handleStatusChange = async (nuevoEstado: Factura['estado']) => {
    if (nuevoEstado === factura.estado) return

    setIsUpdating(true)
    try {
      await updateFactura({ id: factura.idFactura, data: { estado: nuevoEstado } }).unwrap()
      toast.success(`Factura ${factura.numeroFactura} actualizada a ${nuevoEstado.toLowerCase()}`)
    } catch (error) {
      console.error("Error al actualizar estado:", error)
      toast.error("No se pudo actualizar el estado de la factura")
    } finally {
      setIsUpdating(false)
      setIsOpen(false)
    }
  }

  const estadosDisponibles: Factura['estado'][] = ['PENDIENTE', 'PAGADA', 'ANULADA', 'VENCIDA']

  return (
    <motion.div 
      className="flex items-center gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {showLabel && <EstadoFacturaBadge estado={factura.estado} />}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={isUpdating} 
              className="h-8 px-2 transition-all duration-200"
            >
              <AnimatePresence mode="wait">
                {isUpdating ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, rotate: -180 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 180 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="chevron"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="sr-only">Cambiar estado</span>
            </Button>
          </motion.div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <AnimatePresence>
            {estadosDisponibles.map((estado, index) => (
              <motion.div
                key={estado}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.05 }}
              >
                <DropdownMenuItem
                  onClick={() => handleStatusChange(estado)}
                  disabled={estado === factura.estado || isUpdating}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <EstadoFacturaBadge estado={estado} />
                  {estado === factura.estado && (
                    <motion.span 
                      className="ml-2 text-xs text-muted-foreground"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                      Actual
                    </motion.span>
                  )}
                </DropdownMenuItem>
              </motion.div>
            ))}
          </AnimatePresence>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  )
}
