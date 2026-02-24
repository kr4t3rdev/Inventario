"use client"

import { useState } from "react"
import { Package, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RestockForm } from "./restock-form"
import { Producto } from "../../app/models/model"

interface RestockDialogProps {
  producto: Producto
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function RestockDialog({ producto, trigger, onSuccess }: RestockDialogProps) {
  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
    if (onSuccess) {
      onSuccess()
    }
  }

  const handleCancel = () => {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Restock
          </Button>
        )}
      </DialogTrigger>
      <AnimatePresence>
        {open && (
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-purple-600/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                    >
                      <Package className="h-5 w-5 text-white" />
                    </motion.div>
                    <div>
                      <DialogTitle className="text-xl">
                        Restock de Producto
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        Agregue inventario al producto <span className="font-semibold text-primary">{producto.nombre}</span>
                      </DialogDescription>
                    </div>
                  </div>
                </div>
              </DialogHeader>
              <motion.div 
                className="p-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <RestockForm
                  producto={producto}
                  onSuccess={handleSuccess}
                  onCancel={handleCancel}
                />
              </motion.div>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  )
}
