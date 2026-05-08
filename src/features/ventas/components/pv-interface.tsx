"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ShoppingCart, Store, Package, Search, Loader2, Sparkles, TrendingUp, Filter, CreditCard, Truck, Calendar, LayoutGrid, List, Table as TableIcon, X, Minus, Plus, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useGetPuntosDeVentaQuery } from "@/features/puntos-venta"
import { useGetProductosPorUbicacionQuery } from "@/lib/redux/services/productosUbicacionApi"
import { useAddVentaMutation } from "@/features/ventas"
import { useGetClientesQuery } from "@/features/clientes"
import { useGetCategoriasQuery } from "@/features/categorias"
import { useGetAnticiposDisponiblesQuery } from "@/features/contabilidad/api/contabilidadApi"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { getAuthToken } from "@/lib/token"
import { getPrecioEfectivo } from "@/lib/types/pricing"
import { ProductoCard } from "./producto-card"
import { CartItem } from "./cart-item"
import { useDebounce } from "@/hooks/use-debounce"

interface CartProduct {
  cartId: string // Unique identifier for the cart item
  id: string
  nombre: string
  precioVenta: number
  cantidad: number
  stock: number
  unidad?: {
    simbolo: string
  }
}

export function VentaInterface() {
  const router = useRouter()
  const anticiposFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_ANTICIPOS !== "false"
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>("all")
  const [soloConStock, setSoloConStock] = useState<boolean>(false)
  const [showFilters, setShowFilters] = useState<boolean>(false)
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [barcodeInput, setBarcodeInput] = useState<string>("")
  const [selectedPuntoVenta, setSelectedPuntoVenta] = useState<string>("")
  const [viewMode, setViewMode] = useState<"grid" | "list" | "table">("grid")
  const [cart, setCart] = useState<CartProduct[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [selectedClienteId, setSelectedClienteId] = useState<string>("")
  const [descuento, setDescuento] = useState<number>(0)
  const [cargoTransporte, setCargoTransporte] = useState<number>(0)
  const [observaciones, setObservaciones] = useState<string>("")
  const [series, setSeries] = useState<any[]>([])
  const [selectedSerieId, setSelectedSerieId] = useState<string>("")
  const [tipoVencimiento, setTipoVencimiento] = useState<"fecha" | "plazo" | "contra_pago">("contra_pago")
  const [fechaVencimiento, setFechaVencimiento] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedAnticipoCobroId, setSelectedAnticipoCobroId] = useState<string>("")

  const { data: puntosDeVenta, isLoading: isLoadingPuntosVenta } = useGetPuntosDeVentaQuery()
  const {
    data: productos,
    isLoading: isLoadingProductos,
    isFetching: isFetchingProductos,
  } = useGetProductosPorUbicacionQuery(selectedPuntoVenta, {
    skip: !selectedPuntoVenta,
  })

  const [addVenta] = useAddVentaMutation()
  const { data: clientes, isLoading: isLoadingClientes } = useGetClientesQuery()
  const { data: categorias, isLoading: isLoadingCategorias } = useGetCategoriasQuery()
  const { data: anticiposCobroDisponibles, isFetching: isLoadingAnticiposCobro } =
    useGetAnticiposDisponiblesQuery(
      {
        contexto: 'factura',
        clienteId: selectedClienteId || undefined,
        moneda: 'CUP'
      },
      {
        skip: !anticiposFeatureEnabled || !isInvoiceDialogOpen || !selectedClienteId
      }
    )

  // Generar sugerencias de búsqueda
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (value.length > 2 && productos) {
      const suggs = productos
        .filter(p => p.nombre.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5)
        .map(p => p.nombre)
      setSearchSuggestions(suggs)
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
      setSearchSuggestions([])
    }
  }

  const selectSuggestion = (suggestion: string) => {
    setSearchTerm(suggestion)
    setShowSuggestions(false)
  }

  const highlightText = (text: string, term: string) => {
    if (!term) return text
    const regex = new RegExp(`(${term})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, idx) =>
      regex.test(part) ? <span key={idx} className="bg-yellow-200 dark:bg-yellow-800/50 rounded px-0.5">{part}</span> : part
    )
  }

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const product = productos?.find(p => p.codigoBarras === barcodeInput)
      if (product) {
        addToCart({
          id: product.id,
          nombre: product.nombre,
          precioVenta: getPrecioEfectivo(product, clienteListaPrecioId),
          cantidad: 1,
          stock: product.stockEnUbicacion,
          unidad: product.unidad,
        })
        toast(`Producto "${product.nombre}" añadido al carrito`)
        setBarcodeInput("")
      } else {
        toast.error("Producto no encontrado con este código de barras")
        setBarcodeInput("")
      }
    }
  }

  // Limpiar carrito cuando cambia el punto de venta
  useEffect(() => {
    setCart([])
    setSelectedAnticipoCobroId("")
  }, [selectedPuntoVenta])

  // Cargar series de facturación activas
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const token = getAuthToken()
        const res = await fetch("/api/series-facturacion", {
          headers: token ? { Authorization: token } : undefined,
          cache: "no-store",
        })
        if (!res.ok) throw new Error("Error al cargar series")
        let data = await res.json()
        
        // Si no hay series, crear una por defecto
        if (data.length === 0) {
          try {
            const createRes = await fetch("/api/series-facturacion", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: token } : {}),
              },
              body: JSON.stringify({
                prefijo: "SD",
                descripcion: "Serie por defecto para ventas",
                activa: true,
                esPorDefecto: true,
              }),
            })
            if (createRes.ok) {
              const nuevaSerie = await createRes.json()
              data = [nuevaSerie]
              toast.success("Serie de facturación por defecto creada")
            }
          } catch (createError) {
            console.error("Error al crear serie por defecto:", createError)
          }
        }
        
        setSeries(data)
        const defaultSerie = data.find((s: any) => s.esPorDefecto && s.activa)
        if (defaultSerie) {
          setSelectedSerieId(defaultSerie.serieId)
        }
      } catch (error) {
        console.error("Error fetching series:", error)
        toast.error("No se pudieron cargar las series de facturación")
      }
    }
    fetchSeries()
  }, [])

  // Filtrar productos
  const filteredProducts = productos?.filter(
    (producto) => {
      const matchSearch =
        debouncedSearchTerm === "" ||
        producto.nombre.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        producto.descripcion?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        producto.codigoBarras?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())

      const matchCategoria =
        selectedCategoriaId === "all" || producto.categoriaId === selectedCategoriaId

      const matchStock = !soloConStock || producto.stockEnUbicacion > 0

      return matchSearch && matchCategoria && matchStock
    }
  )

  // Obtener listaPrecioId del cliente seleccionado
  const clienteListaPrecioId = useMemo(() => {
    if (!selectedClienteId || !clientes) return null;
    const cliente = clientes.find(c => c.clienteId === selectedClienteId);
    return (cliente as any)?.listaPrecioId || null;
  }, [selectedClienteId, clientes]);

  // Recalcular carrito cuando cambia el cliente (y su lista de precios)
  useEffect(() => {
    if (cart.length > 0 && productos) {
      const updatedCart = cart.map(item => {
        const prod = productos.find(p => p.id === item.id);
        if (prod) {
          const newPrice = getPrecioEfectivo(prod, clienteListaPrecioId);
          if (newPrice !== item.precioVenta) {
            toast(`Precio de ${item.nombre} actualizado por cambio de cliente`);
            return { ...item, precioVenta: newPrice };
          }
        }
        return item;
      });
      // Solo actualizamos si hubo cambios reales para evitar re-renders infinitos
      const hasChanges = updatedCart.some((item, i) => item.precioVenta !== cart[i].precioVenta);
      if (hasChanges) {
        setCart(updatedCart);
      }
    }
  }, [clienteListaPrecioId, productos]);

  // Calcular total del carrito
  const cartTotal = cart.reduce((total, item) => total + item.precioVenta * item.cantidad, 0)
  const totalConDescuento = Math.max(0, cartTotal - (Number.isFinite(descuento) ? descuento : 0))

  // Añadir producto al carrito
  const addToCart = (product: Omit<CartProduct, 'cartId'>) => {
    const existingItem = cart.find((item) => item.id === product.id && item.precioVenta === product.precioVenta)

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.cartId === existingItem.cartId ? { ...item, cantidad: Math.min(item.cantidad + 1, item.stock) } : item,
        ),
      )
      if (existingItem.cantidad >= product.stock) {
        toast(`No hay más unidades disponibles de ${product.nombre}`)
      }
    } else {
      setCart([...cart, { ...product, cartId: crypto.randomUUID(), cantidad: 1 }])
    }
  }

  // Actualizar cantidad
  const updateQuantity = (cartId: string, newQuantity: number) => {
    const product = cart.find((item) => item.cartId === cartId)

    if (product && newQuantity > 0 && newQuantity <= product.stock) {
      setCart(cart.map((item) => (item.cartId === cartId ? { ...item, cantidad: newQuantity } : item)))
    } else if (product && newQuantity <= 0) {
      removeFromCart(cartId)
    } else if (product && newQuantity > product.stock) {
      toast(`Solo hay ${product.stock} unidades disponibles de ${product.nombre}`)
    }
  }

  // Actualizar precio
  const updatePrice = (cartId: string, newPrice: number) => {
    if (newPrice < 0) return
    setCart(cart.map((item) => (item.cartId === cartId ? { ...item, precioVenta: newPrice } : item)))
  }

  // Eliminar producto del carrito
  const removeFromCart = (cartId: string) => {
    setCart(cart.filter((item) => item.cartId !== cartId))
  }

  // Procesar venta
  const processVenta = async () => {
    if (!selectedPuntoVenta) {
      toast("Debe seleccionar un punto de venta para continuar")
      return
    }

    if (cart.length === 0) {
      toast("Añada productos al carrito para realizar una venta")
      return
    }

    setIsProcessing(true)

    try {
      const productos = cart.map((item) => ({
        productoId: item.id,
        cantidad: item.cantidad,
        precioVenta: item.precioVenta,
      }))

      await addVenta({
        productos,
        puntoDeVentaId: selectedPuntoVenta,
        descuento: Math.round(descuento),
        observaciones,
      } as any).unwrap()

      toast(`Se ha registrado la venta por $${totalConDescuento}`)
      setCart([])
      router.refresh()
    } catch (error: any) {
      console.error("Error al procesar venta:", error)
      if (error.data?.error === "Stock insuficiente") {
        toast(`Solo hay ${error.data.stockDisponible} unidades disponibles del producto`)
      } else {
        toast("Ha ocurrido un error al procesar la venta. Intente nuevamente.")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Procesar venta y generar factura
  const processVentaConFactura = async () => {
    if (!selectedPuntoVenta) {
      toast("Debe seleccionar un punto de venta para continuar")
      return
    }
    if (!selectedClienteId) {
      toast("Seleccione un cliente para emitir la factura")
      return
    }
    if (cart.length === 0) {
      toast("Añada productos al carrito para realizar una venta")
      return
    }

    setIsProcessing(true)
    try {
      let fechaVencimientoISO = null;
      if (tipoVencimiento === 'fecha' && fechaVencimiento) {
        fechaVencimientoISO = new Date(fechaVencimiento).toISOString();
      } else if (tipoVencimiento === 'plazo') {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + 30);
        fechaVencimientoISO = fecha.toISOString();
      }

      const productos = cart.map((item) => ({
        productoId: item.id,
        cantidad: item.cantidad,
        precioVenta: item.precioVenta,
      }))

      const ventaCreada = await addVenta({
        productos,
        puntoDeVentaId: selectedPuntoVenta,
        clienteId: selectedClienteId,
        descuento: Math.round(descuento),
        impuestos: 0,
        cargoTransporte: Number(cargoTransporte) || 0,
        observaciones,
        ...(selectedSerieId && { serieId: selectedSerieId }),
        fechaVencimiento: fechaVencimientoISO,
        tipoVencimiento,
        formaPagoAnticipo: selectedAnticipoCobroId ? 'ANTICIPO_COBRO' : undefined,
        anticipoCobroId: anticiposFeatureEnabled ? selectedAnticipoCobroId || undefined : undefined,
        idempotencyKey: anticiposFeatureEnabled && selectedAnticipoCobroId
          ? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`)
          : undefined,
      } as any).unwrap()

      toast(`Venta registrada y factura generada por $${cartTotal}`)
      setCart([])
      setIsInvoiceDialogOpen(false)
      setSelectedClienteId("")
      setSelectedAnticipoCobroId("")
      setCargoTransporte(0)
      const ventaId = ventaCreada?.ventaId
      if (ventaId) {
        router.push(`/busy/invoice/print?id=${ventaId}`)
      } else {
        router.push("/busy/invoice/print")
      }
      router.refresh()
    } catch (error: any) {
      console.error("Error al procesar venta con factura:", error)
      const errorCode = error?.data?.code
      if (errorCode === 'CONCURRENCIA') {
        toast.error("El anticipo fue usado por otra operación. Refresque y seleccione otro anticipo.")
        return
      }
      if (errorCode === 'IDEMPOTENCIA_CONFLICTO') {
        toast.error("Conflicto de idempotencia al ejecutar el anticipo. Reintente la operación.")
        return
      }
      if (errorCode === 'TASA_INVALIDA') {
        toast.error("No existe una tasa válida para ejecutar el anticipo en la moneda de la factura.")
        return
      }
      if (errorCode === 'COBERTURA_INSUFICIENTE' || errorCode === 'EJECUCION_PARCIAL_NO_PERMITIDA') {
        toast.error("El anticipo no cubre el total de la factura.")
        return
      }
      if (error.data?.error === "Stock insuficiente") {
        toast(`Solo hay ${error.data.stockDisponible} unidades disponibles del producto`)
      } else {
        toast("Ha ocurrido un error al procesar la venta. Intente nuevamente.")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Loading inicial
  if (isLoadingPuntosVenta) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Panel izquierdo: Selector de punto de venta y productos */}
      <div className="md:col-span-2 space-y-6">
        {/* Header con selección de punto de venta */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-dashed overflow-hidden">
            <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 mb-4">
                <motion.div 
                  className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Store className="h-5 w-5 text-white" />
                </motion.div>
                <div className="relative">
                  <h2 className="text-lg font-semibold">Punto de Venta</h2>
                  <p className="text-sm text-muted-foreground">Seleccione el punto de venta para ver los productos</p>
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
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/3">
                  <Select value={selectedPuntoVenta} onValueChange={setSelectedPuntoVenta}>
                    <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                      <SelectValue placeholder="Seleccionar punto de venta" />
                    </SelectTrigger>
                    <SelectContent>
                      {puntosDeVenta?.map((punto) => (
                        <SelectItem key={punto.pvId} value={punto.pvId}>
                          <div className="flex items-center">
                            <Store className="mr-2 h-4 w-4" />
                            {punto.nombre}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="relative w-full md:w-2/3">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar productos..."
                    className="pl-10 pr-10 transition-all duration-200 focus:scale-[1.01]"
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    disabled={!selectedPuntoVenta}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  />
                  {searchTerm !== debouncedSearchTerm && !showSuggestions && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-spin" />
                  )}
                  <AnimatePresence>
                    {showSuggestions && searchSuggestions.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border rounded-md shadow-lg z-50 mt-1 max-h-60 overflow-y-auto"
                      >
                        {searchSuggestions.map((suggestion, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between transition-colors"
                            onClick={() => selectSuggestion(suggestion)}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <span className="text-sm">{highlightText(suggestion, searchTerm)}</span>
                            <Search className="h-3 w-3 text-muted-foreground" />
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Escanear código de barras y presionar Enter"
                  className="pl-10 transition-all duration-200 focus:scale-[1.01]"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  disabled={!selectedPuntoVenta}
                />
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Filtros */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros de búsqueda
                </CardTitle>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    {showFilters ? "Ocultar" : "Mostrar"}
                  </Button>
                </motion.div>
              </div>
              <AnimatePresence>
                {showFilters && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4 pt-4 overflow-hidden"
                  >
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Categoría</Label>
                      <Select value={selectedCategoriaId} onValueChange={setSelectedCategoriaId}>
                        <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                          <SelectValue placeholder="Todas las categorías" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las categorías</SelectItem>
                          {categorias?.map((categoria) => (
                            <SelectItem key={categoria.catId} value={categoria.catId}>
                              {categoria.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="stock-filter"
                        checked={soloConStock}
                        onCheckedChange={(checked) => setSoloConStock(checked as boolean)}
                      />
                      <Label
                        htmlFor="stock-filter"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Mostrar solo productos con stock disponible
                      </Label>
                    </div>

                    <AnimatePresence>
                      {(selectedCategoriaId !== "all" || soloConStock) && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCategoriaId("all")
                              setSoloConStock(false)
                            }}
                          >
                            Limpiar filtros
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Productos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-dashed overflow-hidden">
            <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="w-8 h-8 bg-linear-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center"
                    whileHover={{ scale: 1.05 }}
                  >
                    <Package className="h-4 w-4 text-white" />
                  </motion.div>
                  <CardTitle>
                    {selectedPuntoVenta
                      ? `Productos disponibles en ${puntosDeVenta?.find((p) => p.pvId === selectedPuntoVenta)?.nombre || ""}`
                      : "Seleccione un punto de venta para ver productos"}
                  </CardTitle>
                </div>
                
                {/* Selector de tipo de vista */}
                <AnimatePresence>
                  {selectedPuntoVenta && filteredProducts && filteredProducts.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg"
                    >
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setViewMode("grid")}
                        className={`p-2 rounded-md transition-all duration-200 cursor-pointer ${
                          viewMode === "grid" 
                            ? "bg-primary text-white shadow-md" 
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        aria-label="Vista de cuadrícula"
                        title="Vista de cuadrícula"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setViewMode("list")}
                        className={`p-2 rounded-md transition-all duration-200 cursor-pointer ${
                          viewMode === "list" 
                            ? "bg-primary text-white shadow-md" 
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        aria-label="Vista de lista"
                        title="Vista de lista"
                      >
                        <List className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setViewMode("table")}
                        className={`p-2 rounded-md transition-all duration-200 cursor-pointer ${
                          viewMode === "table" 
                            ? "bg-primary text-white shadow-md" 
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        aria-label="Vista de tabla"
                        title="Vista de tabla"
                      >
                        <TableIcon className="h-4 w-4" />
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedPuntoVenta ? (
                <motion.div 
                  className="flex flex-col items-center justify-center h-64 text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Store className="h-12 w-12 text-muted-foreground mb-2" />
                  </motion.div>
                  <h3 className="text-lg font-medium">Seleccione un punto de venta</h3>
                  <p className="text-muted-foreground">
                    Debe seleccionar un punto de venta para ver los productos disponibles
                  </p>
                </motion.div>
              ) : isLoadingProductos || isFetchingProductos ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <motion.div
                    className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <p className="text-muted-foreground">Cargando productos...</p>
                </div>
              ) : filteredProducts && filteredProducts.length > 0 ? (
                <AnimatePresence mode="wait">
                  {viewMode === "grid" && (
                    <motion.div 
                      key="grid-view"
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {filteredProducts.map((producto, index) => (
                        <motion.div
                          key={producto.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03, duration: 0.3 }}
                        >
                          <ProductoCard
                            producto={{
                              ...producto,
                              precioVenta: getPrecioEfectivo(producto, clienteListaPrecioId),
                              stock: producto.stockEnUbicacion,
                            }}
                            onAddToCart={() =>
                              addToCart({
                                id: producto.id,
                                nombre: producto.nombre,
                                precioVenta: getPrecioEfectivo(producto, clienteListaPrecioId),
                                cantidad: 1,
                                stock: producto.stockEnUbicacion,
                                unidad: producto.unidad,
                              })
                            }
                            searchTerm={debouncedSearchTerm}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {viewMode === "list" && (
                    <motion.div 
                      key="list-view"
                      className="space-y-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {filteredProducts.map((producto, index) => (
                        <motion.div
                          key={producto.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02, duration: 0.3 }}
                          whileHover={{ scale: 1.005 }}
                          className="flex items-center gap-4 p-3 border rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() =>
                            addToCart({
                              id: producto.id,
                              nombre: producto.nombre,
                              precioVenta: getPrecioEfectivo(producto, clienteListaPrecioId),
                              cantidad: 1,
                              stock: producto.stockEnUbicacion,
                              unidad: producto.unidad,
                            })
                          }
                        >
                          {producto.fotos && producto.fotos.length > 0 ? (
                            <motion.div
                              className="w-12 h-12 rounded-lg overflow-hidden bg-muted"
                              style={{ flexShrink: 0 }}
                              whileHover={{ scale: 1.05 }}
                            >
                              <img 
                                src={producto.fotos[0]} 
                                alt={producto.nombre}
                                className="w-full h-full object-cover"
                              />
                            </motion.div>
                          ) : (
                            <motion.div
                              className="w-12 h-12 bg-linear-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center"
                              style={{ flexShrink: 0 }}
                              whileHover={{ scale: 1.05, rotate: 5 }}
                            >
                              <Package className="h-5 w-5 text-primary" />
                            </motion.div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{highlightText(producto.nombre, debouncedSearchTerm)}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {producto.categoria?.nombre && (
                                <Badge variant="outline" className="text-[10px]">
                                  {producto.categoria.nombre}
                                </Badge>
                              )}
                              <span className={producto.stockEnUbicacion === 0 ? "text-red-500" : producto.stockEnUbicacion < 5 ? "text-yellow-500" : ""}>
                                Stock: {producto.stockEnUbicacion} {producto.unidad?.simbolo || "u"}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right" style={{ flexShrink: 0 }}>
                            <motion.p 
                              className="text-lg font-bold text-primary"
                              key={getPrecioEfectivo(producto, clienteListaPrecioId)}
                              initial={{ scale: 1.1 }}
                              animate={{ scale: 1 }}
                            >
                              ${getPrecioEfectivo(producto, clienteListaPrecioId).toFixed(2)}
                            </motion.p>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="mt-1 p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                              disabled={producto.stockEnUbicacion === 0}
                            >
                              <Plus className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {viewMode === "table" && (
                    <motion.div 
                      key="table-view"
                      className="overflow-x-auto"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium text-muted-foreground">Imagen</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Producto</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Categoría</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Precio</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Stock</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProducts.map((producto, index) => (
                            <motion.tr
                              key={producto.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02, duration: 0.2 }}
                              className="border-b hover:bg-muted/30 transition-colors"
                            >
                              <td className="p-3">
                                {producto.fotos && producto.fotos.length > 0 ? (
                                  <motion.div
                                    className="w-10 h-10 rounded-lg overflow-hidden bg-muted"
                                    whileHover={{ scale: 1.1 }}
                                  >
                                    <img 
                                      src={producto.fotos[0]} 
                                      alt={producto.nombre}
                                      className="w-full h-full object-cover"
                                    />
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    className="w-10 h-10 bg-linear-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center"
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                  >
                                    <Package className="h-4 w-4 text-primary" />
                                  </motion.div>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="font-medium">{highlightText(producto.nombre, debouncedSearchTerm)}</div>
                                {producto.descripcion && (
                                  <div className="text-sm text-muted-foreground truncate" style={{ maxWidth: "200px" }}>
                                    {producto.descripcion}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                {producto.categoria?.nombre && (
                                  <Badge variant="outline" className="text-xs">
                                    {producto.categoria.nombre}
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <motion.span 
                                  className="font-bold text-primary"
                                  key={getPrecioEfectivo(producto, clienteListaPrecioId)}
                                  initial={{ scale: 1.1 }}
                                  animate={{ scale: 1 }}
                                >
                                  ${getPrecioEfectivo(producto, clienteListaPrecioId).toFixed(2)}
                                </motion.span>
                              </td>
                              <td className="p-3 text-center">
                                <Badge 
                                  variant={
                                    producto.stockEnUbicacion === 0 ? "destructive" : 
                                    producto.stockEnUbicacion < 5 ? "secondary" : "outline"
                                  }
                                >
                                  {producto.stockEnUbicacion} {producto.unidad?.simbolo || "u"}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() =>
                                    addToCart({
                                      id: producto.id,
                                      nombre: producto.nombre,
                                      precioVenta: getPrecioEfectivo(producto, clienteListaPrecioId),
                                      cantidad: 1,
                                      stock: producto.stockEnUbicacion,
                                      unidad: producto.unidad,
                                    })
                                  }
                                  className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={producto.stockEnUbicacion === 0}
                                >
                                  <Plus className="h-4 w-4" />
                                </motion.button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
              ) : (
                <motion.div 
                  className="flex flex-col items-center justify-center h-64 text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Package className="h-12 w-12 text-muted-foreground mb-2" />
                  </motion.div>
                  <h3 className="text-lg font-medium">No se encontraron productos</h3>
                  <p className="text-muted-foreground">
                    {searchTerm
                      ? "No hay productos que coincidan con su búsqueda"
                      : "No hay productos disponibles en este punto de venta"}
                  </p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Panel derecho: Carrito de compras */}
      <div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-dashed sticky top-20 overflow-hidden">
            <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <motion.div
                  className="w-8 h-8 bg-linear-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mr-2"
                  whileHover={{ scale: 1.05 }}
                >
                  <ShoppingCart className="h-4 w-4 text-white" />
                </motion.div>
                Carrito de compras
                <AnimatePresence>
                  {cart.length > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                      <Badge variant="secondary" className="ml-2">
                        {cart.length} {cart.length === 1 ? "producto" : "productos"}
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <motion.div 
                  className="flex flex-col items-center justify-center h-64 text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mb-2" />
                  </motion.div>
                  <h3 className="text-lg font-medium">Carrito vacío</h3>
                  <p className="text-muted-foreground">Añada productos al carrito para realizar una venta</p>
                </motion.div>
              ) : (
                <ScrollArea className="h-100 pr-4">
                  <motion.div 
                    className="space-y-4"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0 },
                      visible: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.1
                        }
                      }
                    }}
                  >
                    <AnimatePresence mode="popLayout">
                      {cart.map((item, index) => (
                        <motion.div
                          key={item.cartId}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <CartItem 
                            item={item} 
                            onUpdateQuantity={updateQuantity} 
                            onUpdatePrice={updatePrice}
                            onRemove={removeFromCart} 
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </ScrollArea>
              )}
            </CardContent>
            <Separator />
            <CardFooter className="flex flex-col pt-4 space-y-3">
              <motion.div 
                className="grid grid-cols-1 gap-2 w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div>
                  <span className="text-sm font-medium mb-1 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" />
                    Descuento
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={descuento}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setDescuento(Number.isFinite(val) ? Math.max(0, val) : 0)
                    }}
                    placeholder="0"
                    className="transition-all duration-200 focus:scale-[1.01]"
                  />
                </div>
                <div>
                  <span className="block text-sm font-medium mb-1">Observaciones</span>
                  <Textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Notas de la venta, comentarios, condiciones, etc."
                    className="transition-all duration-200 focus:scale-[1.01]"
                    style={{ minHeight: "80px" }}
                  />
                </div>
              </motion.div>

              <motion.div 
                className="space-y-1 w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Descuento:</span>
                  <span>- ${Math.min(descuento, cartTotal).toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center w-full">
                  <span className="text-lg font-medium">Total:</span>
                  <motion.span 
                    className="text-xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent"
                    key={totalConDescuento}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    ${totalConDescuento.toFixed(2)}
                  </motion.span>
                </div>
              </motion.div>
              
              <motion.div 
                className="grid grid-cols-1 gap-2 w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white"
                    size="lg"
                    disabled={cart.length === 0 || !selectedPuntoVenta || isProcessing}
                    onClick={processVenta}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      "Crear Venta"
                    )}
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full"
                    size="lg"
                    variant="secondary"
                    disabled={cart.length === 0 || !selectedPuntoVenta || isProcessing}
                    onClick={() => setIsInvoiceDialogOpen(true)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isProcessing ? "Procesando..." : "Crear venta y factura"}
                  </Button>
                </motion.div>
              </motion.div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>

      {/* Diálogo de selección de cliente para facturar */}
      <VentaInvoiceDialog
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        clientes={clientes as any[]}
        selectedClienteId={selectedClienteId}
        setSelectedClienteId={setSelectedClienteId}
        series={series}
        selectedSerieId={selectedSerieId}
        setSelectedSerieId={setSelectedSerieId}
        cargoTransporte={cargoTransporte}
        setCargoTransporte={setCargoTransporte}
        tipoVencimiento={tipoVencimiento}
        setTipoVencimiento={setTipoVencimiento}
        fechaVencimiento={fechaVencimiento}
        setFechaVencimiento={setFechaVencimiento}
        anticiposFeatureEnabled={anticiposFeatureEnabled}
        anticiposCobro={anticiposCobroDisponibles?.anticipos || []}
        selectedAnticipoCobroId={selectedAnticipoCobroId}
        setSelectedAnticipoCobroId={setSelectedAnticipoCobroId}
        isLoadingAnticiposCobro={isLoadingAnticiposCobro}
        onConfirm={processVentaConFactura}
        isProcessing={isProcessing}
        isLoadingClientes={isLoadingClientes}
      />
    </div>
  )
}

// Diálogo para seleccionar cliente
export function VentaInvoiceDialog({
  open,
  onOpenChange,
  clientes,
  selectedClienteId,
  setSelectedClienteId,
  series,
  selectedSerieId,
  setSelectedSerieId,
  cargoTransporte,
  setCargoTransporte,
  tipoVencimiento,
  setTipoVencimiento,
  fechaVencimiento,
  setFechaVencimiento,
  anticiposFeatureEnabled,
  anticiposCobro,
  selectedAnticipoCobroId,
  setSelectedAnticipoCobroId,
  isLoadingAnticiposCobro,
  onConfirm,
  isProcessing,
  isLoadingClientes,
 }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientes: any[] | undefined
  selectedClienteId: string
  setSelectedClienteId: (v: string) => void
  series: any[]
  selectedSerieId: string
  setSelectedSerieId: (v: string) => void
  cargoTransporte: number
  setCargoTransporte: (v: number) => void
  tipoVencimiento: "fecha" | "plazo" | "contra_pago"
  setTipoVencimiento: (v: "fecha" | "plazo" | "contra_pago") => void
  fechaVencimiento: string
  setFechaVencimiento: (v: string) => void
  anticiposFeatureEnabled: boolean
  anticiposCobro: any[]
  selectedAnticipoCobroId: string
  setSelectedAnticipoCobroId: (v: string) => void
  isLoadingAnticiposCobro: boolean
  onConfirm: () => void
  isProcessing: boolean
  isLoadingClientes: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dashed">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <motion.div
                className="w-8 h-8 bg-linear-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center"
                whileHover={{ scale: 1.05 }}
              >
                <CreditCard className="h-4 w-4 text-white" />
              </motion.div>
              Datos para Facturación
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full" />
                Cliente
              </label>
              {isLoadingClientes ? (
                <div className="flex items-center gap-2 p-2 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Cargando clientes...</span>
                </div>
              ) : (
                <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                    <SelectValue placeholder="Elige un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes?.map((c: any) => (
                      <SelectItem key={c.clienteId} value={c.clienteId}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </motion.div>

            {anticiposFeatureEnabled && (
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <label className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Cobro anticipado
              </label>
              <Select
                value={selectedAnticipoCobroId || "__none__"}
                onValueChange={(value) => {
                  const nextValue = value === "__none__" ? "" : value
                  setSelectedAnticipoCobroId(nextValue)
                  if (nextValue) {
                    setTipoVencimiento("contra_pago")
                  }
                }}
              >
                <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                  <SelectValue placeholder="Sin anticipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin anticipo</SelectItem>
                  {anticiposCobro.map((anticipo: any) => (
                    <SelectItem key={anticipo.anticipoId} value={anticipo.anticipoId}>
                      {`${anticipo.anticipoId.slice(0, 8)} · Saldo ${Number(anticipo.saldoDisponible).toFixed(2)} ${anticipo.moneda}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isLoadingAnticiposCobro
                  ? "Cargando cobros anticipados disponibles..."
                  : "Opcional: aplica y ejecuta un cobro anticipado al facturar"}
              </p>
            </motion.div>
            )}

            <motion.div 
              className="space-y-3 border p-3 rounded-md dark:border-gray-700"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Vencimiento de la Factura
              </Label>
              <RadioGroup 
                value={tipoVencimiento} 
                onValueChange={(val) => setTipoVencimiento(val as any)}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fecha" id="v-fecha" />
                  <Label htmlFor="v-fecha" className="font-normal cursor-pointer">Fecha concreta</Label>
                </div>
                
                <AnimatePresence>
                  {tipoVencimiento === 'fecha' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-6 mt-1 mb-2"
                    >
                      <Input 
                        type="date" 
                        value={fechaVencimiento} 
                        onChange={(e) => setFechaVencimiento(e.target.value)}
                        className="w-full transition-all duration-200 focus:scale-[1.01]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Se agregará a Cuentas por Cobrar</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="plazo" id="v-plazo" />
                  <Label htmlFor="v-plazo" className="font-normal cursor-pointer">Plazo de 30 días</Label>
                </div>
                <AnimatePresence>
                  {tipoVencimiento === 'plazo' && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-muted-foreground ml-6"
                    >
                      Se agregará a Cuentas por Cobrar con vencimiento a 30 días
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contra_pago" id="v-contra" />
                  <Label htmlFor="v-contra" className="font-normal cursor-pointer">Contra pago (Pago directo)</Label>
                </div>
                <AnimatePresence>
                  {tipoVencimiento === 'contra_pago' && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-muted-foreground ml-6"
                    >
                      Se registra conciliación completa y cierre total de la factura
                    </motion.p>
                  )}
                </AnimatePresence>
              </RadioGroup>
            </motion.div>

            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="text-sm font-medium">Serie de Facturación</label>
              {series.length === 0 ? (
                <div className="flex items-center gap-2 p-2 border rounded-md dark:border-gray-700 bg-muted/50">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Cargando series de facturación...</span>
                </div>
              ) : (
                <Select value={selectedSerieId} onValueChange={setSelectedSerieId}>
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                    <SelectValue placeholder="Selecciona una serie" />
                  </SelectTrigger>
                  <SelectContent>
                    {series.filter((s: any) => s.activa).map((serie: any) => (
                      <SelectItem key={serie.serieId} value={serie.serieId}>
                        {serie.prefijo} - {serie.descripcion} {serie.esPorDefecto ? "(Por defecto)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </motion.div>

            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Cargo por Transporte (MN)
              </label>
              <Input 
                type="number" 
                min="0"
                step="0.01"
                value={cargoTransporte}
                onChange={(e) => setCargoTransporte(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="transition-all duration-200 focus:scale-[1.01]"
              />
            </motion.div>
          </div>
          
          <DialogFooter className="mt-6">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                Cancelar
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={onConfirm} 
                disabled={!selectedClienteId || isProcessing}
                className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Confirmar y facturar"
                )}
              </Button>
            </motion.div>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
