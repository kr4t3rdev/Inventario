'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { createVentaServicioAction } from "@/features/venta-servicios/actions"
import { useGetClientesQuery } from "@/features/clientes/api/ClienteApi"
import { toast } from "sonner"
import { CreditCard, Plus, Minus, X, ShoppingCart } from "lucide-react"

interface ServicioItem {
  cartItemId: string
  servicioId: string
  nombre: string
  precio: number
  costo: number
  descripcion: string
  cantidad: number
}

interface ServiciosCartProps {
  cart: ServicioItem[]
  setCart: React.Dispatch<React.SetStateAction<ServicioItem[]>>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export default function ServiciosCart({ cart, setCart, isOpen, onOpenChange }: ServiciosCartProps) {
  const { data: clientes } = useGetClientesQuery()
  const [selectedClienteId, setSelectedClienteId] = useState<string>("")
  const [observaciones, setObservaciones] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Calcular total del carrito
  const cartTotal = cart.reduce((total, item) => total + item.precio * item.cantidad, 0)

  // Calcular costo total del carrito
  const cartCostoTotal = cart.reduce((total, item) => total + item.costo * item.cantidad, 0)

  // Remover servicio del carrito
  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => item.cartItemId !== cartItemId))
  }

  // Actualizar cantidad de servicio en carrito
  const updateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1) return
    
    setCart(cart.map(item => 
      item.cartItemId === cartItemId 
        ? { ...item, cantidad: newQuantity } 
        : item
    ))
  }

  // Actualizar precio de servicio en carrito
  const updatePrice = (cartItemId: string, newPrice: number) => {
    if (newPrice < 0) return
    
    setCart(cart.map(item => 
      item.cartItemId === cartItemId 
        ? { ...item, precio: newPrice } 
        : item
    ))
  }

  // Actualizar costo de servicio en carrito
  const updateCosto = (cartItemId: string, newCosto: number) => {
    if (newCosto < 0) return
    
    setCart(cart.map(item => 
      item.cartItemId === cartItemId 
        ? { ...item, costo: newCosto } 
        : item
    ))
  }

  // Procesar venta de servicios
  const processVenta = async () => {
    if (cart.length === 0) {
      toast("Añada servicios al carrito para realizar una venta")
      return
    }

    if (!selectedClienteId) {
      toast("Seleccione un cliente para continuar")
      return
    }

    setIsProcessing(true)
    try {
      for (const item of cart) {
        const result = await createVentaServicioAction({
          servicioId: item.servicioId,
          cantidad: item.cantidad,
          costo: item.costo,
          clienteId: selectedClienteId,
          observaciones,
          total: item.costo * item.cantidad,
        })
        if (!result.success) {
          throw new Error(result.error?.message ?? 'Error desconocido')
        }
      }

      toast("Venta de servicios procesada exitosamente")
      setCart([])
      setSelectedClienteId("")
      setObservaciones("")
      onOpenChange(false)
    } catch (error) {
      console.error("Error al procesar la venta:", error)
      toast("Hubo un error al procesar la venta")
    } finally {
      setIsProcessing(false)
    }
  }

  const isCartEmpty = cart.length === 0

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrito de Servicios ({cart.length})
          </DialogTitle>
          <DialogDescription>
            Revise y procese la venta de servicios
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isCartEmpty ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Su carrito está vacío</h3>
              <p className="text-muted-foreground">Agregue servicios al carrito para continuar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Lista de productos en el carrito */}
              <div className="rounded-md border">
                  <div className="grid grid-cols-12 p-4 text-sm font-medium bg-muted/50">
                  <div className="col-span-3">Servicio</div>
                  <div className="col-span-2 text-center">Precio</div>
                  <div className="col-span-2 text-center">Costo</div>
                  <div className="col-span-2 text-center">Cantidad</div>
                  <div className="col-span-2 text-center">Subtotal</div>
                  <div className="col-span-1 text-right">Acciones</div>
                </div>
                <Separator />
                {cart.map((item) => (
                  <div key={item.cartItemId} className="grid grid-cols-12 p-4 items-center">
                    <div className="col-span-3">
                      <div className="font-medium">{item.nombre}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">{item.descripcion}</div>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <div className="relative w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          min={0}
                          value={item.precio}
                          onChange={(e) => updatePrice(item.cartItemId, Number(e.target.value))}
                          className="pl-6 h-8 text-center text-sm"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <div className="relative w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          min={0}
                          value={item.costo}
                          onChange={(e) => updateCosto(item.cartItemId, Number(e.target.value))}
                          className="pl-6 h-8 text-center text-sm"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-center items-center space-x-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.cartItemId, item.cantidad - 1)}
                        disabled={item.cantidad <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center font-medium text-sm">{item.cantidad}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.cartItemId, item.cantidad + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="col-span-2 text-center font-medium text-sm">
                      {formatCurrency(item.precio * item.cantidad)}
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Separator className="col-span-12 mt-4" />
                  </div>
                ))}
              </div>

              {/* Información del cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Cliente *</h4>
                  <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes?.map((cliente) => (
                        <SelectItem key={cliente.clienteId} value={cliente.clienteId}>
                          {cliente.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Observaciones</h4>
                  <Input
                    placeholder="Observaciones adicionales"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </div>

              {/* Resumen de la venta */}
              <div className="rounded-md border p-4 bg-muted/50">
                <h4 className="font-medium mb-3">Resumen de la Venta</h4>
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.cartItemId} className="flex justify-between text-sm">
                      <span>{item.nombre} x{item.cantidad}</span>
                      <span>{formatCurrency(item.precio * item.cantidad)}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Costo Total</span>
                    <span>{formatCurrency(cartCostoTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">Margen</span>
                    <span>{formatCurrency(cartTotal - cartCostoTotal)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isProcessing}
          >
            Cerrar
          </Button>
          <Button 
            onClick={processVenta} 
            disabled={!selectedClienteId || isCartEmpty || isProcessing}
            className="min-w-35"
          >
            {isProcessing ? (
              <>Procesando...</>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Confirmar Venta
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}