
"use client"

import { useMemo } from "react"
import { 
  Download,
  DollarSign
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { useGetIngresosPorEdadesQuery } from "@/lib/redux/services/cuentasPorCobrarApi"
import { formatCurrency } from "@/lib/utils"

export default function IngresosPorEdadesPage() {
  const { data, isLoading } = useGetIngresosPorEdadesQuery()
  const reporte = data?.reporte
  const facturas = data?.facturas

  const totals = useMemo(() => {
    if (!reporte) return { corriente: 0, dias30: 0, dias60: 0, dias90: 0, dias120: 0, total: 0 }
    return reporte.reduce((acc, curr) => ({
      corriente: acc.corriente + curr.corriente,
      dias30: acc.dias30 + curr.dias30,
      dias60: acc.dias60 + curr.dias60,
      dias90: acc.dias90 + curr.dias90,
      dias120: acc.dias120 + curr.dias120,
      total: acc.total + curr.total
    }), { corriente: 0, dias30: 0, dias60: 0, dias90: 0, dias120: 0, total: 0 })
  }, [reporte])

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Ingresos por Edades</h2>
              <p className="text-muted-foreground">
                Antigüedad de saldos por cliente y factura
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
             <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Deuda Total
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
                    <p className="text-xs text-muted-foreground">
                      Total cuentas por cobrar
                    </p>
                  </CardContent>
             </Card>
          </div>

          <Tabs defaultValue="cliente" className="space-y-4">
            <TabsList>
              <TabsTrigger value="cliente">Por Cliente</TabsTrigger>
              <TabsTrigger value="factura">Por Factura</TabsTrigger>
            </TabsList>
            
            <TabsContent value="cliente" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Detalle por Cliente</CardTitle>
                  <CardDescription>
                    Desglose de deuda por tiempo de antigüedad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Suma Corriente</TableHead>
                        <TableHead className="text-right">30 Días</TableHead>
                        <TableHead className="text-right">60 Días</TableHead>
                        <TableHead className="text-right">90 Días</TableHead>
                        <TableHead className="text-right">120 Días</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-4">Cargando datos...</TableCell>
                        </TableRow>
                      ) : reporte?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">No hay deudas pendientes.</TableCell>
                        </TableRow>
                      ) : (
                        <>
                        {reporte?.map((item) => (
                          <TableRow key={item.clienteId}>
                            <TableCell className="font-medium">{item.nombre}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.corriente)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.dias30)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.dias60)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.dias90)}</TableCell>
                            <TableCell className="text-right text-destructive font-medium">{formatCurrency(item.dias120)}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(item.total)}</TableCell>
                          </TableRow>
                        ))}
                        {/* Totals Row */}
                        <TableRow className="bg-muted/50 font-bold">
                            <TableCell>TOTALES</TableCell>
                            <TableCell className="text-right">{formatCurrency(totals.corriente)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totals.dias30)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totals.dias60)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totals.dias90)}</TableCell>
                            <TableCell className="text-right text-destructive">{formatCurrency(totals.dias120)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totals.total)}</TableCell>
                        </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="factura" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Detalle por Factura</CardTitle>
                  <CardDescription>
                    Listado de todas las facturas pendientes con su antigüedad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Factura #</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Fecha Emisión</TableHead>
                        <TableHead className="text-center">Días Antigüedad</TableHead>
                        <TableHead className="text-center">Categoría</TableHead>
                        <TableHead className="text-right">Saldo Pendiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">Cargando datos...</TableCell>
                        </TableRow>
                      ) : facturas?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No hay facturas pendientes.</TableCell>
                        </TableRow>
                      ) : (
                        facturas?.map((factura) => (
                          <TableRow key={factura.id}>
                            <TableCell className="font-medium">{factura.numero}</TableCell>
                            <TableCell>{factura.cliente}</TableCell>
                            <TableCell>{new Date(factura.fecha).toLocaleDateString()}</TableCell>
                            <TableCell className="text-center">{factura.dias} días</TableCell>
                            <TableCell className="text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                factura.categoria === 'Corriente' ? 'bg-green-100 text-green-800' :
                                factura.categoria === '30-60 Días' ? 'bg-yellow-100 text-yellow-800' :
                                factura.categoria === '60-90 Días' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {factura.categoria}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(factura.saldo)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
