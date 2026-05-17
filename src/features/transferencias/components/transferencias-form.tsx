"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import { z } from "zod"
import { Plus, Trash2, Package, ArrowRight, ArrowLeftRight, Check, Search, X, AlertTriangle, TrendingDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { sileo } from '@/lib/sileo-shim'
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { usePuntosDeVenta } from "@/features/puntos-venta/hooks/use-puntos-de-venta"
import { useAlmacenes } from "@/features/almacenes/hooks/use-almacenes"
import { getProductosAction } from "@/features/productos"
import { getStockPorUbicacionAction } from "@/features/productos/actions"
import { createTransferenciaAction, updateTransferenciaAction } from "@/features/transferencias/actions"

const productoTransferenciaSchema = z.object({
  productoId: z.string({
    required_error: "Seleccione un producto",
  }),
  cantidad: z.coerce.number()
    .positive({ message: "La cantidad debe ser mayor a 0" })
    .max(10000, { message: "La cantidad máxima es 10000 unidades" })
    .refine((val) => Number.isInteger(val), {
      message: "La cantidad debe ser un número entero"
    }),
})

function ProductoSelector({
  value,
  onChange,
  productos,
  disabled,
  triggerId,
  showOutOfStock = false,
  minStockThreshold = 10,
}: {
  value: string
  onChange: (v: string) => void
  productos: Array<any>
  disabled?: boolean
  triggerId?: string
  showOutOfStock?: boolean
  minStockThreshold?: number
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const selected = productos?.find((p) => p.id === value)

  const filteredProducts = (productos || []).filter((p) => {
    const stock = p.stockUbicacion ?? p.stock ?? 0
    const matchesQuery = query ? p.nombre.toLowerCase().includes(query.toLowerCase()) : true

    if (p.id === value) return true

    if (p.productoPadreId) return false

    if (!showOutOfStock && stock <= 0) return false

    return matchesQuery
  })

  useEffect(() => {
    setHighlighted(0)
  }, [query])

  useEffect(() => {
    itemRefs.current = []
  }, [filteredProducts.length])

  useEffect(() => {
    const highlightedElement = itemRefs.current[highlighted]
    if (highlightedElement) {
      highlightedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [highlighted])

  const renderHighlighted = (text: string) => {
    if (!query) return text
    const lower = text.toLowerCase()
    const q = query.toLowerCase()
    const idx = lower.indexOf(q)
    if (idx === -1) return text
    const before = text.slice(0, idx)
    const match = text.slice(idx, idx + q.length)
    const after = text.slice(idx + q.length)
    return (
      <>
        {before}
        <span className="font-semibold bg-yellow-200/50 dark:bg-yellow-500/30 text-foreground rounded px-0.5">{match}</span>
        {after}
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls="transferencia-producto-listbox"
          disabled={disabled}
          className={cn(
            "w-full justify-between bg-background hover:bg-accent/50 transition-colors",
            !value && "text-muted-foreground"
          )}
        >
          {selected ? (
            <span className="truncate text-left font-medium">
              {selected.nombre}
            </span>
          ) : (
            <span className="text-muted-foreground">Seleccionar producto...</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent id="transferencia-producto-listbox" className="w-87.5 p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 px-0"
            placeholder="Buscar producto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (!filteredProducts.length) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlighted((h) => Math.min(h + 1, filteredProducts.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlighted((h) => Math.max(h - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const p = filteredProducts[highlighted]
                if (p) {
                  onChange(p.id)
                  setOpen(false)
                  setQuery("")
                }
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setOpen(false)
              }
            }}
          />
        </div>

        {selected && (
           <div className="p-1 border-b bg-muted/30">
             <Button
               type="button"
               size="sm"
               variant="ghost"
               className="w-full h-8 px-2 text-xs justify-start text-muted-foreground hover:text-foreground"
               onClick={() => {
                 onChange("")
                 setOpen(false)
                 setQuery("")
               }}
             >
               <X className="mr-2 h-3 w-3" />
               Limpiar selección actual
             </Button>
           </div>
        )}

        <ScrollArea className="h-72">
          {filteredProducts.length ? (
            <ul className="p-1">
              {filteredProducts.map((p: any, i: number) => {
                const stock = p.stockUbicacion ?? p.stock ?? 0
                const isOutOfStock = stock <= 0
                const isLowStock = stock > 0 && stock < minStockThreshold
                const isDisabled = isOutOfStock && !showOutOfStock

                return (
                  <li key={p.id}>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            ref={(el) => { itemRefs.current[i] = el }}
                            type="button"
                            disabled={isDisabled}
                            className={cn(
                              "w-full text-left px-3 py-2.5 rounded-sm flex items-center justify-between text-sm transition-colors",
                              i === highlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 hover:text-accent-foreground",
                              value === p.id && "bg-accent/80 font-medium",
                              isDisabled && "opacity-50 cursor-not-allowed"
                            )}
                            onMouseEnter={() => setHighlighted(i)}
                            onClick={() => {
                              if (!isDisabled) {
                                onChange(p.id)
                                setOpen(false)
                                setQuery("")
                              }
                            }}
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="truncate flex-1">{renderHighlighted(p.nombre)}</div>
                                {isLowStock && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                )}
                                {isOutOfStock && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                                    Sin Stock
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>Stock: 
                                  <span className={cn(
                                    isOutOfStock ? "text-red-500" : 
                                    isLowStock ? "text-amber-500" : "text-green-600 dark:text-green-400"
                                  )}>
                                    {stock}
                                  </span> {p.unidad?.simbolo}
                                </span>
                                <span>·</span>
                                <span>${p.precioCosto}</span>
                              </div>
                            </div>
                            {value === p.id && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-medium">{p.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              Stock disponible: {stock} {p.unidad?.simbolo}
                            </p>
                            {isLowStock && (
                              <p className="text-xs text-amber-500 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Stock bajo (&lt; {minStockThreshold} unidades)
                              </p>
                            )}
                            {isOutOfStock && (
                              <p className="text-xs text-destructive font-medium">
                                Producto sin stock disponible
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No se encontraron productos.
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

const transferenciaSchema = z
  .object({
    productos: z.array(productoTransferenciaSchema).min(1, {
      message: "Debe agregar al menos un producto",
    }),
    tipoOrigen: z.enum(["almacen", "punto_venta"], {
      required_error: "Seleccione el tipo de origen",
    }),
    origenId: z.string({
      required_error: "Seleccione un origen",
    }),
    tipoDestino: z.enum(["almacen", "punto_venta"], {
      required_error: "Seleccione el tipo de destino",
    }),
    destinoId: z.string({
      required_error: "Seleccione un destino",
    }),
    descripcion: z.string().optional(),
  })
  .refine((data) => !(data.tipoOrigen === data.tipoDestino && data.origenId === data.destinoId), {
    message: "El origen y destino no pueden ser iguales",
    path: ["destinoId"],
  })

type TransferenciaFormValues = z.infer<typeof transferenciaSchema>

interface TransferenciaFormProps {
  initialData?: {
    transferenciaId: string
    productos: Array<{
      productoId: string
      cantidad: number      
    }>
    tipoOrigen: "almacen" | "punto_venta"
    origenId: string
    tipoDestino: "almacen" | "punto_venta"
    destinoId: string
    descripcion?: string
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function TransferenciaForm({ initialData }: TransferenciaFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [productoSearch, setProductoSearch] = useState("")
  const [showOutOfStock, setShowOutOfStock] = useState(false)
  const [minStockAlert, setMinStockAlert] = useState<string | null>(null)
  const isEdit = Boolean(initialData)

  const debouncedSearch = useDebounce(productoSearch, 300)

  const [productos, setProductos] = useState<any[]>([])
  const [isLoadingProductos, setIsLoadingProductos] = useState(true)
  const { puntosDeVenta, isLoading: isLoadingPuntosDeVenta } = usePuntosDeVenta()
  const { almacenes, isLoading: isLoadingAlmacenes } = useAlmacenes()

  useEffect(() => {
    const loadProductos = async () => {
      const result = await getProductosAction()
      if (result.success) setProductos(result.data ?? [])
      setIsLoadingProductos(false)
    }

    void loadProductos()
  }, [])

  const form = useForm<TransferenciaFormValues>({
    resolver: zodResolver(transferenciaSchema),
    defaultValues: {
      productos: initialData?.productos || [{ productoId: "", cantidad: 1 }],
      tipoOrigen: initialData?.tipoOrigen || "almacen",
      origenId: initialData?.origenId || "",
      tipoDestino: initialData?.tipoDestino || "punto_venta",
      destinoId: initialData?.destinoId || "",
      descripcion: initialData?.descripcion || "",
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "productos",
  })

  const tipoOrigen = form.watch("tipoOrigen")
  const tipoDestino = form.watch("tipoDestino")
  const origenId = form.watch("origenId")
  const productosSeleccionados = form.watch("productos")

  // ─── Server Action: stock por ubicación ──────────────
  const [productosUbicacion, setProductosUbicacion] = useState<any[] | null>(null)
  const [isLoadingProductosUbicacion, setIsLoadingProductosUbicacion] = useState(false)

  useEffect(() => {
    if (!origenId || !tipoOrigen) {
      setProductosUbicacion(null)
      return
    }
    let cancelled = false
    setIsLoadingProductosUbicacion(true)
    getStockPorUbicacionAction({ ubicacionId: origenId, tipoUbicacion: tipoOrigen, includeZero: true })
      .then(r => {
        if (cancelled) return
        if (r.success) setProductosUbicacion(r.data ?? [])
        else setProductosUbicacion([])
        setIsLoadingProductosUbicacion(false)
      })
    return () => { cancelled = true }
  }, [origenId, tipoOrigen])

  const productosDisponiblesEnOrigen = origenId && productosUbicacion ? productosUbicacion : productos

  const getProductosDisponibles = (currentIndex: number) => {
    const productosSeleccionadosIds = productosSeleccionados
      .map((p, index) => (index !== currentIndex ? p.productoId : null))
      .filter(Boolean)

    const productosBase = productosDisponiblesEnOrigen || productos || []
    const sinSeleccionados = productosBase?.filter((p) => !productosSeleccionadosIds.includes(p.id))
    if (!productoSearch) return sinSeleccionados
    const term = productoSearch.toLowerCase()
    return sinSeleccionados.filter((p) => p.nombre.toLowerCase().includes(term))
  }

  const getProductoInfo = (productoId: string) => {
    const productosBase = productosDisponiblesEnOrigen || productos || []
    return productosBase.find((p) => p.id === productoId) || productos?.find((p) => p.id === productoId)
  }

  const getTotalProductos = () => {
    return productosSeleccionados.reduce((total, item) => {
      const producto = getProductoInfo(item.productoId)
      if (producto && item.cantidad) {
        return total + item.cantidad * producto.precioVenta
      }
      return total
    }, 0)
  }

  async function onSubmit(data: TransferenciaFormValues) {
    setIsLoading(true)
    try {
      let result

      if (initialData) {
        const firstProducto = data.productos[0]
        const cantidad = Number(firstProducto?.cantidad)

        if (!firstProducto?.productoId || !Number.isFinite(cantidad) || cantidad <= 0) {
          sileo.error({ title: 'Debe seleccionar un producto y una cantidad válida.' })
          setIsLoading(false)
          return
        }

        result = await updateTransferenciaAction({
          transferenciaId: initialData.transferenciaId,
          productoId: firstProducto.productoId,
          cantidad,
          tipoOrigen: data.tipoOrigen,
          origenId: data.origenId,
          tipoDestino: data.tipoDestino,
          destinoId: data.destinoId,
        })
      } else {
        result = await createTransferenciaAction(data)
      }

      if (!result.success) {
        throw new Error(result.error?.message || "Error al guardar la transferencia")
      }

      sileo.success({ title: `La transferencia de ${data.productos.length} producto(s) ha sido ${initialData ? "actualizada" : "registrada"} exitosamente.` })

      if (!initialData) {
        form.reset({
          productos: [{ productoId: "", cantidad: 1 }],
          tipoOrigen: "almacen",
          origenId: "",
          tipoDestino: "punto_venta",
          destinoId: "",
          descripcion: "",
        })
        setProductoSearch("")
      }
    } catch (error) {
      console.error("Error al guardar la transferencia:", error)
      sileo.error({ title: error instanceof Error ? error.message : 'Hubo un error al guardar la transferencia.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingProductos || isLoadingPuntosDeVenta || isLoadingAlmacenes) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-6">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <Skeleton className="h-64 w-full rounded-xl" />
             <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
    <Card className="w-full max-w-6xl mx-auto shadow-md border-border/60">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-linear-to-br from-orange-500 to-red-600 rounded-lg shadow-sm">
                <Package className="h-6 w-6 text-white" />
              </div>
              {initialData ? "Editar Transferencia" : "Nueva Transferencia Múltiple"}
            </CardTitle>
            <CardDescription>
              {initialData 
                ? "Modifique los detalles de la transferencia existente." 
                : "Mueva inventario entre almacenes y puntos de venta fácilmente."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Form {...form}>
          <form id="transferencia-form" onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start relative">
              <motion.div 
                className="space-y-6 p-6 rounded-xl border bg-card shadow-sm ring-1 ring-border/50 relative overflow-hidden group"
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-green-500 to-green-600 dark:from-green-600 dark:to-green-800" />
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="bg-green-100/50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                    <ArrowRight className="h-3 w-3 mr-1" /> ORIGEN
                  </Badge>
                  <h3 className="text-lg font-semibold text-foreground">¿Desde dónde envía?</h3>
                </div>

                <FormField
                  control={form.control}
                  name="tipoOrigen"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-muted-foreground">Tipo de Ubicación</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(val) => {
                            field.onChange(val)
                            form.setValue("origenId", "")
                          }}
                          defaultValue={field.value}
                          className="grid grid-cols-2 gap-4"
                        >
                          <Label
                            htmlFor="origen-almacen"
                            className={cn(
                              "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                              field.value === "almacen" && "border-green-600 bg-green-50 dark:bg-green-950/20 dark:border-green-500"
                            )}
                          >
                            <RadioGroupItem value="almacen" id="origen-almacen" className="sr-only" />
                            <span className="text-sm font-medium">Almacén</span>
                          </Label>
                          <Label
                            htmlFor="origen-punto-venta"
                            className={cn(
                              "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                              field.value === "punto_venta" && "border-green-600 bg-green-50 dark:bg-green-950/20 dark:border-green-500"
                            )}
                          >
                            <RadioGroupItem value="punto_venta" id="origen-punto-venta" className="sr-only" />
                            <span className="text-sm font-medium">Punto de Venta</span>
                          </Label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="origenId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">
                        Seleccione el {tipoOrigen === "almacen" ? "Almacén" : "Punto de Venta"}
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue
                              placeholder="Seleccionar ubicación..."
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tipoOrigen === "almacen"
                            ? almacenes?.map((almacen) => (
                              <SelectItem key={almacen.almacenId} value={almacen.almacenId}>
                                {almacen.nombre}
                              </SelectItem>
                            ))
                            : puntosDeVenta?.map((puntoDeVenta) => (
                              <SelectItem key={puntoDeVenta.pvId} value={puntoDeVenta.pvId}>
                                {puntoDeVenta.nombre}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-background rounded-full p-2 border shadow-md text-muted-foreground">
                <ArrowLeftRight className="h-6 w-6" />
              </div>

              <motion.div 
                className="space-y-6 p-6 rounded-xl border bg-card shadow-sm ring-1 ring-border/50 relative overflow-hidden group"
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="absolute top-0 right-0 w-1 h-full bg-linear-to-b from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-800" />
                <div className="flex items-center justify-end gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-foreground">¿Hacia dónde envía?</h3>
                  <Badge variant="outline" className="bg-blue-100/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                    DESTINO <ArrowRight className="h-3 w-3 ml-1" />
                  </Badge>
                </div>

                <FormField
                  control={form.control}
                  name="tipoDestino"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-muted-foreground text-right block">Tipo de Ubicación</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(val) => {
                            field.onChange(val)
                            form.setValue("destinoId", "")
                          }}
                          defaultValue={field.value}
                          className="grid grid-cols-2 gap-4"
                        >
                          <Label
                            htmlFor="destino-almacen"
                            className={cn(
                              "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                              field.value === "almacen" && "border-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-500"
                            )}
                          >
                            <RadioGroupItem value="almacen" id="destino-almacen" className="sr-only" />
                            <span className="text-sm font-medium">Almacén</span>
                          </Label>
                          <Label
                            htmlFor="destino-punto-venta"
                            className={cn(
                              "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                              field.value === "punto_venta" && "border-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-500"
                            )}
                          >
                            <RadioGroupItem value="punto_venta" id="destino-punto-venta" className="sr-only" />
                            <span className="text-sm font-medium">Punto de Venta</span>
                          </Label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="text-right" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destinoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground text-right block">
                        Seleccione el {tipoDestino === "almacen" ? "Almacén" : "Punto de Venta"}
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue
                              placeholder="Seleccionar ubicación..."
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tipoDestino === "almacen"
                            ? almacenes?.map((almacen) => (
                              <SelectItem key={almacen.almacenId} value={almacen.almacenId}>
                                {almacen.nombre}
                              </SelectItem>
                            ))
                            : puntosDeVenta?.map((puntoDeVenta) => (
                              <SelectItem key={puntoDeVenta.pvId} value={puntoDeVenta.pvId}>
                                {puntoDeVenta.nombre}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-right" />
                    </FormItem>
                  )}
                />
              </motion.div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    Productos a Transferir
                    <Badge variant="secondary" className="rounded-full px-2.5">{fields.length}</Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {origenId
                      ? `Productos disponibles en: ${
                          tipoOrigen === "almacen" 
                            ? almacenes?.find(a => a.almacenId === origenId)?.nombre 
                            : puntosDeVenta?.find(pv => pv.pvId === origenId)?.nombre
                        }`
                      : "⚠️ Seleccione primero el origen para cargar productos"
                    }
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={productoSearch}
                      onChange={(e) => setProductoSearch(e.target.value)}
                      placeholder="Filtrar disponibles..."
                      className="pl-9"
                      disabled={!origenId}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-out-of-stock"
                        checked={showOutOfStock}
                        onCheckedChange={(checked) => setShowOutOfStock(checked as boolean)}
                        disabled={!origenId}
                      />
                      <label
                        htmlFor="show-out-of-stock"
                        className="text-sm text-muted-foreground cursor-pointer select-none"
                      >
                        Mostrar sin stock
                      </label>
                    </div>

                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => append({ productoId: "", cantidad: 1 })}
                      className="shrink-0"
                      disabled={!origenId || isEdit}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {fields.map((field, index) => {
                    const productosDisponibles = getProductosDisponibles(index)
                    const productoSeleccionado = getProductoInfo(productosSeleccionados[index]?.productoId)

                    const maxDisponible: number | undefined = productoSeleccionado
                      ? ("stockUbicacion" in productoSeleccionado
                          ? productoSeleccionado.stockUbicacion
                          : productoSeleccionado.stock)
                      : undefined
                    const disponibleTexto: number = productoSeleccionado
                      ? ("stockUbicacion" in productoSeleccionado
                          ? productoSeleccionado.stockUbicacion
                          : productoSeleccionado.stock)
                      : 0
                    const unidadSimbolo: string | undefined = (productoSeleccionado as any)?.unidad?.simbolo

                    return (
                      <motion.div
                        key={field.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                      >
                        <Card className="p-4 border-l-4 border-l-primary/20 hover:border-l-primary transition-all">
                          <div className="flex items-start gap-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground text-sm font-medium mt-1">
                              {index + 1}
                            </div>

                             <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                               <FormField
                                 control={form.control}
                                 name={`productos.${index}.productoId`}
                                 render={({ field }) => (
                                   <FormItem className="md:col-span-6">
                                     <FormLabel className="text-xs uppercase text-muted-foreground block mb-2">Producto</FormLabel>
                                     <FormControl>
                                       <ProductoSelector
                                         value={field.value}
                                         onChange={field.onChange}
                                         productos={productosDisponibles}
                                         disabled={!origenId}
                                         triggerId={`producto-selector-${index}`}
                                         showOutOfStock={showOutOfStock}
                                         minStockThreshold={10}
                                       />
                                     </FormControl>
                                     <FormMessage />
                                   </FormItem>
                                 )}
                               />

                               <FormField
                                 control={form.control}
                                 name={`productos.${index}.cantidad`}
                                 render={({ field }) => {
                                   const cantidadValue = Number(field.value) || 0
                                   const stockDisponible = maxDisponible ?? 0
                                   const porcentajeUsado = stockDisponible > 0 ? (cantidadValue / stockDisponible) * 100 : 0
                                   const excedeStock = cantidadValue > stockDisponible
                                   const stockBajo = stockDisponible > 0 && stockDisponible < 10
                                   const stockQuedariaBajo = stockDisponible - cantidadValue < 10 && stockDisponible - cantidadValue >= 0

                                   return (
                                     <FormItem className="md:col-span-3">
                                       <FormLabel className="text-xs uppercase text-muted-foreground block mb-2">Cantidad</FormLabel>
                                       <FormControl>
                                         <div className="relative">
                                           <Input
                                             type="number"
                                             min={1}
                                             max={maxDisponible}
                                             {...field}
                                             className={cn(
                                               "pr-12",
                                               excedeStock && "border-destructive focus-visible:ring-destructive"
                                             )}
                                             onKeyDown={(e) => {
                                               if (e.key === 'Enter') {
                                                 e.preventDefault()
                                                 const cantidadVal = Number((e.currentTarget as HTMLInputElement).value)
                                                 const tieneProducto = Boolean(productosSeleccionados[index]?.productoId)
                                                 const cantidadOk = Number.isFinite(cantidadVal) && cantidadVal > 0
                                                 const maxDisp = Number(maxDisponible ?? 0)
                                                 if (cantidadVal > maxDisp) {
                                                   sileo.warning({ title: 'La cantidad supera el stock disponible.' })
                                                   return
                                                 }
                                                 if (!isEdit && origenId && tieneProducto && cantidadOk) {
                                                   append({ productoId: "", cantidad: 1 })
                                                   setTimeout(() => {
                                                     const next = document.getElementById(`producto-selector-${index + 1}`) as HTMLButtonElement | null
                                                     if (next) {
                                                       next.click()
                                                     }
                                                   }, 0)
                                                 }
                                               }
                                             }}
                                           />
                                           <div className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">
                                             {unidadSimbolo || 'ud'}
                                           </div>
                                         </div>
                                       </FormControl>

                                       {productoSeleccionado && stockDisponible > 0 && (
                                         <div className="mt-2 space-y-1">
                                           <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                             <div 
                                               className={cn(
                                                 "h-full transition-all duration-300",
                                                 porcentajeUsado > 90 ? "bg-destructive" :
                                                 porcentajeUsado > 70 ? "bg-amber-500" :
                                                 "bg-green-500"
                                               )}
                                               style={{ width: `${Math.min(porcentajeUsado, 100)}%` }}
                                             />
                                           </div>
                                           <div className="flex justify-between text-[10px] text-muted-foreground">
                                             <span>Usando: {porcentajeUsado.toFixed(0)}%</span>
                                             <span>Disp: {stockDisponible}</span>
                                           </div>
                                         </div>
                                       )}

                                       {productoSeleccionado && (
                                         <div className="mt-2 space-y-1">
                                           <FormDescription className="text-xs flex items-center gap-1">
                                             <span className={cn(
                                               "font-medium",
                                               stockBajo ? "text-amber-500" : "text-foreground"
                                             )}>
                                               Disp: {disponibleTexto}
                                             </span>
                                             {unidadSimbolo && <span>{unidadSimbolo}</span>}
                                             {origenId && (
                                               <span className="text-blue-600 dark:text-blue-400 text-[10px]">
                                                 (local)
                                               </span>
                                             )}
                                             {stockBajo && (
                                               <TooltipProvider delayDuration={100}>
                                                 <Tooltip>
                                                   <TooltipTrigger asChild>
                                                     <AlertTriangle className="h-3 w-3 text-amber-500 ml-1" />
                                                   </TooltipTrigger>
                                                   <TooltipContent>
                                                     <p className="text-xs">Stock bajo (&lt; 10 unidades)</p>
                                                   </TooltipContent>
                                                 </Tooltip>
                                               </TooltipProvider>
                                             )}
                                           </FormDescription>

                                           {stockQuedariaBajo && !excedeStock && (
                                             <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                                               <TrendingDown className="h-3 w-3" />
                                               <span>Quedarían {stockDisponible - cantidadValue} unidades</span>
                                             </div>
                                           )}

                                           {excedeStock && (
                                             <Badge variant="destructive" className="text-[10px] mt-1">
                                               Stock Insuficiente
                                             </Badge>
                                           )}
                                         </div>
                                       )}
                                       <FormMessage />
                                     </FormItem>
                                   )
                                 }}
                               />

                               <div className="md:col-span-3 flex flex-col">
                                 <Label className="text-xs uppercase text-muted-foreground block mb-2">Valor Estimado</Label>
                                 <div className="h-10 flex items-center px-3 bg-muted/50 rounded-md border border-transparent">
                                   {productoSeleccionado && productosSeleccionados[index]?.cantidad ? (
                                     <span className="font-mono font-medium">
                                       $
                                       {(productoSeleccionado.precioVenta * productosSeleccionados[index].cantidad).toFixed(
                                         2,
                                       )}
                                     </span>
                                   ) : (
                                     <span className="text-muted-foreground text-sm">$0.00</span>
                                   )}
                                 </div>
                               </div>
                             </div>

                            {!isEdit && fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 mt-6"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>

                {fields.length === 0 && (
                   <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/20">
                     <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                     <h3 className="text-lg font-medium text-muted-foreground">No hay productos agregados</h3>
                     <p className="text-sm text-muted-foreground/80 mb-4">Agregue productos para iniciar la transferencia</p>
                     <Button
                        type="button"
                        variant="outline"
                        onClick={() => append({ productoId: "", cantidad: 1 })}
                        disabled={!origenId}
                      >
                        Agregar primer producto
                      </Button>
                   </div>
                )}
              </div>

              {productosSeleccionados.some((p) => p.productoId && p.cantidad) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-muted/30 p-6 rounded-xl border border-border/60"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Package className="h-6 w-6" />
                      </div>
                      <div>
                         <p className="font-medium text-lg">Resumen de Transferencia</p>
                         <p className="text-sm text-muted-foreground">
                           {productosSeleccionados.filter(p => p.productoId && p.cantidad > 0).length} productos distintos
                         </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Valor Total Estimado</p>
                      <p className="text-2xl font-bold tracking-tight text-primary">
                        ${getTotalProductos().toFixed(2)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas / Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Especifique el motivo de la transferencia (opcional)..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => router.push("/busy/transferencias")}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || fields.length === 0}
                className="min-w-37.5"
              >
                {isLoading ? (
                  <>Guardando...</>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {initialData ? "Guardar Cambios" : "Confirmar Transferencia"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
    </motion.div>
  )
}
