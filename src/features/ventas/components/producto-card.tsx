"use client"

import { motion } from "framer-motion"
import { PlusCircle, Package } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ProductoCardProps {
  producto: {
    id: string
    nombre: string
    descripcion?: string | null
    precioVenta: number
    stock: number
    fotos?: string[]
    unidad?: {
      simbolo: string
    }
    categoria?: {
      nombre: string
    }
    subcategoria?: {
      nombre: string
    }
  }
  onAddToCart: () => void
  searchTerm?: string
}

const highlightText = (text: string, term?: string) => {
  if (!term) return text
  const regex = new RegExp(`(${term})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, idx) =>
    regex.test(part) ? <span key={`${part}-${idx}`} className="bg-yellow-200 dark:bg-yellow-800/50 rounded px-0.5">{part}</span> : part
  )
}

export function ProductoCard({ producto, onAddToCart, searchTerm }: ProductoCardProps) {
  const stockBadgeVariant = producto.stock === 0 ? 'destructive' : producto.stock < 5 ? 'secondary' : 'outline'
  const fotos = producto.fotos ?? []
  const hasPhotos = fotos.length > 0
  const fotoUrl = hasPhotos ? fotos[0] : null

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Card className="overflow-hidden h-full flex flex-col border-dashed hover:border-primary/50 transition-colors duration-200">
        <CardContent className="pt-6 flex-grow">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-start gap-2">
              {fotoUrl ? (
                <motion.div
                  className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted"
                  whileHover={{ scale: 1.05 }}
                >
                  <img 
                    src={fotoUrl} 
                    alt={producto.nombre}
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              ) : (
                <motion.div
                  className="w-8 h-8 bg-linear-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                >
                  <Package className="h-4 w-4 text-white" />
                </motion.div>
              )}
              <h3 className="font-medium line-clamp-2">{highlightText(producto.nombre, searchTerm)}</h3>
            </div>
            <Badge 
              variant={stockBadgeVariant} 
              className="ml-2 whitespace-nowrap flex-shrink-0"
            >
              {producto.stock} {producto.unidad?.simbolo || "u"}
            </Badge>
          </div>
          {(producto.categoria?.nombre || producto.subcategoria?.nombre) && (
            <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
              {producto.categoria?.nombre && (
                <Badge variant="outline" className="text-[10px] dark:border-gray-700">
                  {producto.categoria.nombre}
                </Badge>
              )}
              {producto.subcategoria?.nombre && (
                <>
                  <span className="px-0.5">›</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {producto.subcategoria.nombre}
                  </Badge>
                </>
              )}
            </div>
          )}
          {producto.descripcion && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{producto.descripcion}</p>
          )}
          <motion.p 
            className="text-lg font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent"
            key={producto.precioVenta}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            ${producto.precioVenta.toFixed(2)}
          </motion.p>
        </CardContent>
        <CardFooter className="pt-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    onClick={onAddToCart} 
                    className="w-full bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90 text-white" 
                    disabled={producto.stock === 0}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                {producto.stock === 0 ? "Sin stock disponible" : "Añadir al carrito"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
