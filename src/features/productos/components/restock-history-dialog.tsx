"use client"

import { useState } from "react"
import { History } from "lucide-react"
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
import { RestockHistory } from "./restock-history"
import { useGetRestockHistoryQuery } from "@/features/productos/api/productosApi"

interface RestockHistoryDialogProps {
  productoId: string
  productoNombre: string
  trigger?: React.ReactNode
}

export function RestockHistoryDialog({
  productoId,
  productoNombre,
  trigger
}: RestockHistoryDialogProps) {
  const [open, setOpen] = useState(false)

  const { data, isLoading, error } = useGetRestockHistoryQuery(productoId, {
    skip: !open, // Only fetch when dialog is open
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex gap-2">
            <History className="h-4 w-4" />
            Historial
          </Button>
        )}
      </DialogTrigger>
      <AnimatePresence>
        {open && (
          <DialogContent className="max-w-[1500px] w-[1200px] max-h-[95vh] flex flex-col p-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              <div className="p-6 pb-0">
                <DialogHeader className="border-b pb-4 bg-linear-to-r from-primary/5 to-purple-600/5 -mx-6 px-6 -mt-6 pt-6">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                    >
                      <History className="h-5 w-5 text-white" />
                    </motion.div>
                    <div>
                      <DialogTitle className="text-xl">
                        Historial de Restock
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        Historial completo de restock para <span className="font-semibold text-primary">{productoNombre}</span>
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
              </div>
              <motion.div 
                className="flex-1 overflow-auto px-6 pb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <RestockHistory
                  data={data}
                  isLoading={isLoading}
                  error={error}
                />
              </motion.div>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  )
}
