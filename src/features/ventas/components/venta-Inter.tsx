'use client'
import { useGetProductosQuery } from "@/features/productos";
import { useGetPuntosDeVentaQuery } from "@/features/puntos-venta";
import { useState } from "react";
import { Producto } from "@/app/models/model";
import { useAddVentaMutation } from "@/features/ventas";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const ventaSchema = z.object({
  productoId: z.string({
    required_error: "Seleccione un producto",
  }),
  cantidad: z.coerce.number().positive({
    message: "La cantidad debe ser mayor a 0",
  }),
  puntoDeVentaId: z.string({
    required_error: "Seleccione un punto de venta",
  }),  
})

type VentaFormValues = z.infer<typeof ventaSchema>

interface VentaFormProps extends Producto{ 
    id:string
    cantidad: number
    precioVenta:number
}

export default function VentaInter() {

    const { data: productos, isLoading: isLoadingProductos } = useGetProductosQuery()
    const { data: puntoDeVenta } = useGetPuntosDeVentaQuery()

    const [ carrito, setCarrito ] = useState<VentaFormProps[]>([])
    const [ puntoVenta, setPuntoVenta ] = useState<string>('')

    const [ addVenta ] = useAddVentaMutation()

    

    const addToCart = ( producto: Producto) => {
        setCarrito((prevCart) => {
            const existingItem = prevCart.find((item) => item.id === producto.id)
            if (existingItem) {
                return prevCart.map((item) => 
                item.id === producto.id
                    ? { ...item, cantidad: item.cantidad + 1}
                    : item
                )
            }
            return [ ...prevCart, { ...producto, cantidad: 1 }]
        })
    }
    const removeFromCart = (productId: string) => {
        setCarrito((prevCart) => prevCart.filter((item) => item.id !== productId))
    }
    const StockChange = (productId: string, stock:number) => {
        setCarrito((prevCart) => 
        prevCart.map((item) =>
            item.id === productId
            ? { ...item, stock: stock > 0 ? stock : 1 }
            : item
        )
      )
    }
    const getTotalPrice = () => {
      return carrito.reduce((sum, c) => sum + (c.precioVenta * c.cantidad), 0)
    }
    
    const getTotalItems = () => {
        return carrito.reduce((sum, c) => sum + c.cantidad, 0)
    }

    const handleCrearVenta = () => {
        if (carrito.length === 0 || !puntoVenta) {
            toast.error('Carrito vacío o punto de venta no seleccionado')
            return
        }

        // Preparar productos para venta única
        const productos = carrito.map(item => ({
            productoId: item.id,
            cantidad: item.cantidad
        }))

        addVenta({
          productos,
          puntoDeVentaId: puntoVenta,
          descuento: 0,
          observaciones: `Venta única con ${carrito.length} productos`,
          cantidad: 0
        }).unwrap()
        .then(() => {
            toast.success('Venta única creada correctamente')
            setCarrito([])
        })
        .catch((error) => {
            toast.error('Error al crear la venta: ' + (error.data?.error || error.message))
        })
    }
    return(
     
    <div className="flex gap-6">

      {/* Selector de Punto de Venta */}
      <div className="w-1/5">
        <Card>
          <CardHeader>
            <CardTitle>Punto de Venta</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={puntoVenta} onValueChange={setPuntoVenta}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un punto de venta" />
              </SelectTrigger>
              <SelectContent>
                {puntoDeVenta?.map((pv: any) => (
                  <SelectItem key={pv.pvId} value={pv.pvId}>
                    {pv.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Lista de productos */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {productos?.map((producto) => (
                <Card key={producto.id} className="group hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="p-4">
                      <div>
                        
                      </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {producto.categoria?.nombre}
                    </Badge>
                    <CardTitle className="text-lg font-semibold mb-2 line-clamp-2">{producto.nombre}</CardTitle>
                    <p className="text-2xl font-bold text-green-600">${producto.precioVenta}</p>
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    <Button onClick={() => addToCart(producto)} className="w-full text-white" size="sm">
                      <Plus className="w-4 h-4 mr-2 text-white" color='white' />
                      Añadir al Carrito
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          

      {/* Carrito de compras */}
      
          {/* Carrito de Compras */}
          <div className="lg:w-96 order-1 lg:order-2">
            <Card className="sticky top-8">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Carrito de Compras
                  {getTotalItems() > 0 && (
                    <Badge variant="default" className="ml-auto">
                      {getTotalItems()}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {carrito.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">Tu carrito está vacío</p>
                    <p className="text-sm text-gray-400">Añade productos para comenzar</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {carrito.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-12 h-12 relative rounded-md overflow-hidden bg-gray-200 text-center">
                            {
                              item.nombre
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{item.nombre}</h4>
                            <p className="text-green-600 font-semibold">${item.precioVenta} x {item.cantidad} = ${item.precioVenta * item.cantidad}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-8 h-8"
                              onClick={() => StockChange(item.id, item.cantidad - 1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {item.cantidad}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-8 h-8"
                              onClick={() => StockChange(item.id, item.cantidad + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-8 h-8 text-red-500 hover:text-red-700"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>${getTotalPrice()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Envío:</span>
                        <span>Gratis</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-green-600">${getTotalPrice()}</span>
                      </div>
                    </div>

                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleCrearVenta}
                      disabled={carrito.length === 0 || !puntoVenta}
                    >
                      Crear Venta Única
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>   
    
    )
}


{/* <div className="w-1/4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Carrito</CardTitle>
            <ShoppingCart className="h-6 w-6" />
          </CardHeader>
          <CardContent>
            {carrito.length === 0 ? (
              <div className="text-muted-foreground text-center">El carrito está vacío</div>
            ) : (
              <div className="space-y-3">
                {carrito.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{item.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.precioVenta} $ x
                        <Input
                          type="number"
                          min={1}
                          value={}
                          onChange={(e) =>
                            StockChange(item.id, parseInt(e.target.value) || 1)
                          }
                          className="w-14 ml-1 inline-block"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(item.id)}
                      title="Quitar"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <div className="border-t pt-2 font-bold flex justify-between">
                  <span>Productos:</span>
                  <span>{sto?.reduce((sum,c) => sum + c.ca)} </span>
                </div>
                <div className="border-t pt-2 font-bold flex justify-between">
                  <span>Total:</span>
                  <span>{getTotalPrice()} $</span>
                </div>
                <Button
                  className="w-full mt-2 cursor-pointer"
                  onClick={() => {
                    if (carrito.length > 0 && puntoVenta) {
                      carrito.forEach(item => {
                        handleCrearVenta({
                          productoId: item.id,
                          cantidad: item.cantidad,
                          puntoDeVentaId: puntoVenta
                        });
                      });
                    }
                  }}
                  disabled={carrito.length === 0 || !puntoVenta}
                >
                  Crear Venta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div> */}