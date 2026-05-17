"use client"

import { LazyMotion, m as motion } from "framer-motion"
import { Trash2, Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface CartItemProps {
  item: {
    cartId: string
    id: string
    nombre: string
    precioVenta: number
    cantidad: number
    stock: number
    unidad?: {
      simbolo: string
    }
  }
  onUpdateQuantity: (id: string, quantity: number) => void
  onUpdatePrice: (id: string, price: number) => void
  onRemove: (id: string) => void
}

export function CartItem({ item, onUpdateQuantity, onUpdatePrice, onRemove }: CartItemProps) {
  const subtotal = item.precioVenta * item.cantidad

  return (
    <Card className="overflow-hidden border-dashed hover:border-primary/30 transition-colors duration-200">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-grow">
            <h4 className="font-medium line-clamp-1">{item.nombre}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={item.precioVenta}
                onChange={(e) => onUpdatePrice(item.cartId, Number.parseFloat(e.target.value) || 0)}
                className="h-6 w-24 text-sm p-1"
              />
              <span className="text-sm text-muted-foreground">/ {item.unidad?.simbolo || "u"}</span>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground transition-colors"
              onClick={() => onRemove(item.cartId)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Eliminar</span>
            </Button>
          </motion.div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-r-none transition-all duration-200"
                onClick={() => onUpdateQuantity(item.cartId, item.cantidad - 1)}
                disabled={item.cantidad <= 1}
              >
                <Minus className="h-3 w-3" />
                <span className="sr-only">Disminuir cantidad</span>
              </Button>
            </motion.div>
            <Input
              type="number"
              min={1}
              max={item.stock}
              value={item.cantidad}
              onChange={(e) => onUpdateQuantity(item.cartId, Number.parseInt(e.target.value) || 1)}
              className="h-8 w-12 rounded-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all duration-200 focus:scale-105"
            />
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-l-none transition-all duration-200"
                onClick={() => onUpdateQuantity(item.cartId, item.cantidad + 1)}
                disabled={item.cantidad >= item.stock}
              >
                <Plus className="h-3 w-3" />
                <span className="sr-only">Aumentar cantidad</span>
              </Button>
            </motion.div>
          </div>
          <motion.div
            key={subtotal}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Badge variant="secondary" className="font-medium">
              ${subtotal.toFixed(2)}
            </Badge>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
