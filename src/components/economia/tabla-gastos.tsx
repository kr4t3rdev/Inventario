"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingCart, Users, Zap, AlertTriangle, ScissorsLineDashedIcon, DollarSignIcon, DollarSign } from "lucide-react"
//import { useState } from "react"
import { format } from "date-fns"
//import { GastosCompra } from "../../../models/model"
import { useGetGastosCompraQuery, useGetGastosCompraRestockQuery, useGetGastosCompraRegularQuery } from "@/lib/redux/services/GastosCompraApi"
import { useGetEmpleadosQuery } from "@/lib/redux/services/empleadosApi"
import { useGetMermasQuery } from "@/lib/redux/services/mermasApi"
import { useGetProductosQuery } from "@/lib/redux/services/productosApi"
import { useGetGastosDEQuery } from "@/lib/redux/services/gastosDEApi"
import { useGetPagoSalariosQuery } from "@/lib/redux/services/pagoSalarioApi"

export function TablaGastos() {
  // const [gastosCompra, setGastosCompra] = useState<GastoCompra[]>([])
  //const [gastosSalarios, setGastosSalarios] = useState<GastoSalario[]>([])
 // const [gastosUtilitarios, setGastosUtilitarios] = useState<GastoUtilitario[]>([])
  //const [gastosMermas, setGastosMermas] = useState<GastoMerma[]>([])
  // const [busqueda, setBusqueda] = useState("")
  // const [filtroTipo, setFiltroTipo] = useState("todos")
  // const [loading, setLoading] = useState(true)
  const { data:empleados } = useGetEmpleadosQuery()
  const { data: gastosSalario } = useGetPagoSalariosQuery()
  const { data: gastosCompraData } = useGetGastosCompraQuery()
  const { data: gastosCompraRestock } = useGetGastosCompraRestockQuery()
  const { data: gastosCompraRegular } = useGetGastosCompraRegularQuery()
  const { data: gastosDE} = useGetGastosDEQuery()
  const { data: merma } = useGetMermasQuery()
  const { data: productos} = useGetProductosQuery()
   

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "CUP",
    }).format(amount)
  }

  const totalGastosCompra = gastosCompraData?.reduce((sum, gasto) => sum + gasto.total, 0)
  const totalGastosCompraRestock = gastosCompraRestock?.reduce((sum, gasto) => sum + gasto.total, 0)
  const totalGastosCompraRegular = gastosCompraRegular?.reduce((sum, gasto) => sum + gasto.total, 0)
  const totalGastosSalarios = gastosSalario?.reduce((sum, gasto) => sum + gasto.salario, 0)
  const totalGastosServicio = gastosDE?.reduce((sum, gasto) => sum + gasto.monto, 0)
  const totalGastosMermas = merma?.reduce((sum, gasto) => sum + (gasto?.producto?.precioCosto ?? 0) * gasto.cantidad, 0)
  const totalProductos = productos?.reduce((sum, gasto) => sum + gasto.stock, 0)
  // console.log('total de productos:',totalProductos);
  const totalGastos = (totalGastosCompra ?? 0) + (totalGastosSalarios ?? 0) + (totalGastosServicio ?? 0) + (totalGastosMermas ?? 0)
  const totalAgregado = (totalGastosSalarios ?? 0) + (totalGastosServicio ?? 0) + (totalGastosMermas ?? 0)
  //const formularPrecio = totalGastos - 

  return (
    <div className="space-y-4">
      {/* Resumen de Gastos */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos en Compra de Producto</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency((totalGastosCompra ?? 0))}</div>
            <p className="text-xs text-muted-foreground">{gastosCompraData?.length} compras registradas</p>
            <div className="gap-2 mt-2">
              <Badge variant="destructive" className="text-xs">
                Restock: {formatCurrency(totalGastosCompraRestock ?? 0)}
              </Badge>
              <Badge variant="secondary" className="text-xs mt-3">
                Regular: {formatCurrency(totalGastosCompraRegular ?? 0)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Salarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalGastosSalarios ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{empleados?.length} empleados registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos de Explotación</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalGastosServicio ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              {gastosDE?.length} servicios registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Mermas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalGastosMermas ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{merma?.length} mermas registradas</p>
          </CardContent>
        </Card>
        
      </div>
      
      {/* 2do section */}
      
      <div className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium"> Gastos agregados </CardTitle>
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalAgregado)}</div>
              <p className="text-xs text-muted-foreground">Incluye los gastos de la empresa sin contar los gastos por compras de productos</p>
            </CardContent>
          </Card>
          <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalGastos)}</div>
            <p className="text-xs text-muted-foreground">Total de gastos de la Empresa inclyendo los gastos en compras de productos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"> Estimación de agregado segun gastos </CardTitle>
            <ScissorsLineDashedIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalAgregado / (totalProductos ?? 0) )}</div>
            <p className="text-xs text-muted-foreground">Productos registrados :{productos?.length}</p>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Tabla de Gastos por Categorías */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestión de Gastos</CardTitle>
              <CardDescription>Control detallado de todos los gastos operativos</CardDescription>
            </div>
            {/* <div className="flex gap-2">
              <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Gasto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
                    <DialogDescription>Selecciona el tipo de gasto que deseas registrar</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="tipo" className="text-right">
                        Tipo
                      </Label>
                      <Select>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compra">Compra de Productos</SelectItem>
                          <SelectItem value="salario">Pago de Salario</SelectItem>
                          <SelectItem value="utilitario">Gasto Utilitario</SelectItem>
                          <SelectItem value="merma">Registro de Merma</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Continuar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div> */}
          </div>
        </CardHeader>
        <CardContent>
          {/* <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground " />
                <Input
                  placeholder="Buscar gastos..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-8 mx-auto"
                />
              </div>
            </div> */}

            {/* <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tipo de gasto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los gastos</SelectItem>
                <SelectItem value="compras">Compras</SelectItem>
                <SelectItem value="salarios">Salarios</SelectItem>
                <SelectItem value="utilitarios">Utilitarios</SelectItem>
                <SelectItem value="mermas">Mermas</SelectItem>
              </SelectContent>
            </Select> 
          </div>
          */}

          <Tabs defaultValue="compras" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="compras">Compras</TabsTrigger>
              <TabsTrigger value="restock">Restock</TabsTrigger>
              <TabsTrigger value="salarios">Salarios</TabsTrigger>
              <TabsTrigger value="utilitarios">Gastos de Explotación</TabsTrigger>
              <TabsTrigger value="mermas">Mermas</TabsTrigger>
            </TabsList>

            <TabsContent value="compras">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastosCompraData?.map((gasto) => (
                      <TableRow key={gasto.id}>
                        <TableCell>{format(new Date(gasto.fechaCompra), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-medium">{gasto.descripcion}</TableCell>
                        <TableCell>{gasto.vendor.nombre}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={gasto.isRestock ? "default" : "secondary"}
                            className={gasto.isRestock ? "bg-blue-100 text-blue-800" : ""}
                          >
                            {gasto.isRestock ? "Restock" : "Regular"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{gasto.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gasto.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(gasto.total)}
                        </TableCell>                        
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="restock">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastosCompraRestock?.map((gasto) => (
                      <TableRow key={gasto.id}>
                        <TableCell>{format(new Date(gasto.fechaCompra), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-medium">
                          {gasto.descripcion?.replace('Restock - ', '')}
                        </TableCell>
                        <TableCell>{gasto.vendor.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {gasto.descripcion?.includes('Nueva instancia') ? 'Cambio de precios' : 'Mismo precio'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{gasto.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gasto.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium text-blue-600">
                          {formatCurrency(gasto.total)}
                        </TableCell>                        
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="salarios">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Salario Base</TableHead>                      
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastosSalario?.map((gasto) => (
                      <TableRow key={gasto.pgId}>
                        <TableCell className="font-medium">{gasto.empleado?.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{gasto.empleado?.cargo}</Badge>
                        </TableCell>
                        <TableCell>{gasto.periodo}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gasto.salario)}</TableCell>

                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(gasto.salario ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="utilitarios">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastosDE?.map((services) => (
                      <TableRow key={services.gastosDEId}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {services.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>{services.proveedor}</TableCell>
                        <TableCell>{services.periodo}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(services.monto)}
                        </TableCell>
                        
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="mermas">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Costo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {merma?.map((gasto) => (
                      <TableRow key={gasto.mermaId}>
                        <TableCell>{format(new Date(gasto.createdAt), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-medium">{gasto.producto?.nombre}</TableCell>
                        <TableCell className="text-right">{gasto.cantidad}</TableCell>
                        <TableCell>{gasto.motivo && <Badge variant="outline">{gasto.motivo}</Badge>}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency((gasto?.producto?.precioCosto ?? 0) * gasto.cantidad)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
