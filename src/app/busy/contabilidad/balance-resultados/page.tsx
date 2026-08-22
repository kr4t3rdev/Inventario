"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Loader2, TrendingUp, TrendingDown, DollarSign, Wallet, Building2, Landmark, ArrowLeft } from "lucide-react"
import { PageTransition, StaggerContainer, StaggerItem, AnimatedCard } from "@/components/ui/animations"
import { cn } from "@/lib/utils"
import { ContabilidadBreadcrumb } from "@/features/contabilidad/components/contabilidad-breadcrumb"
import { useAuth } from "@/contexts/auth-context"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ACCOUNTING_TIME_ZONE } from "@/lib/services/fecha-operacion-registry"

// Types (match API response)

interface BalanceData {
  activos: { efectivo: number; inventario: number; cuentasPorCobrar: number; total: number }
  pasivos: { deudaExterna: number; total: number }
  patrimonio: { capitalSocial: number; utilidadEjercicio: number; total: number }
}

interface IncomeStatementData {
  mensual: Array<{
    month: number
    monthName: string
    ingresosVentas: number
    ingresosServicios: number
    totalIngresos: number
    ventasCosto: number
    gastosCompras: number
    gastosSalarios: number
    gastosGenerales: number
    gastosMermas: number
    totalGastos: number
    utilidadNeta: number
  }>
  anual: {
    ingresosVentas: number
    ingresosServicios: number
    totalIngresos: number
    gastosCompras: number
    gastosSalarios: number
    gastosGenerales: number
    gastosMermas: number
    totalGastos: number
    utilidadNeta: number
  }
}

interface FinancialData {
  balance: BalanceData
  estadoResultados: IncomeStatementData
  reporte: {
    origen: 'LIVE' | 'SNAPSHOT'
    provisional: boolean
    fechaCorte: string
    resultadoHasta: string | null
    periodoId: string | null
    integridad: 'VALID' | null
    snapshotVersion: number | null
  }
}

interface FinancialPeriod {
  periodId: string
  code: string | null
  year: number
  cutoffAt: string
  snapshotVersion: 2
}

// Common styles for "surface" cards to match other pages
const surfaceCardClass = "bg-white/80 dark:bg-slate-900/10 backdrop-blur-xl border-slate-200/60 dark:border-slate-800/60 shadow-sm"

export default function BalanceResultadosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [year, setYear] = useState<string>(new Date().getFullYear().toString())
  const [data, setData] = useState<FinancialData | null>(null)
  const [availablePeriods, setAvailablePeriods] = useState<FinancialPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const latestRequestId = useRef(0)
  const isBlocked =
    !authLoading &&
    user?.role !== 'admin' &&
    user?.planFeatures?.contabilidad !== true

  useEffect(() => {
    if (isBlocked) {
      router.replace('/busy/contabilidad')
    }
  }, [isBlocked, router])

  useEffect(() => {
    if (isBlocked) {
      return
    }

    const requestId = latestRequestId.current + 1
    latestRequestId.current = requestId
    const controller = new AbortController()

    const fetchData = async () => {
      setLoading(true)
      setErrorMsg(null)
      setData(null)
      try {
        const [res, periodsRes] = await Promise.all([
          fetch(`/api/contabilidad/balance-financiero?year=${year}`, { signal: controller.signal }),
          fetch('/api/contabilidad/balance-financiero/periodos', { signal: controller.signal }),
        ])

        if (requestId !== latestRequestId.current) {
          return
        }

        if (periodsRes.ok) {
          const periodsData = await periodsRes.json()
          if (requestId !== latestRequestId.current) {
            return
          }
          setAvailablePeriods(periodsData.periodos ?? [])
        }

        if (res.ok) {
          const jsonData = await res.json()
          if (requestId !== latestRequestId.current) {
            return
          }
          setData(jsonData)
        } else {
          const body = await res.json().catch(() => ({}))
          if (requestId !== latestRequestId.current) {
            return
          }
          setErrorMsg((body as any).error || `Error ${res.status}`)
        }
      } catch (error) {
        if (controller.signal.aborted || requestId !== latestRequestId.current) {
          return
        }
        setErrorMsg("Error de red al conectar con el servidor")
      } finally {
        if (requestId === latestRequestId.current) {
          setLoading(false)
        }
      }
    }
    fetchData()

    return () => controller.abort()
  }, [isBlocked, year])

  const yearOptions = Array.from(new Set([
    new Date().getFullYear(),
    ...availablePeriods.map((period) => period.year),
  ])).sort((left, right) => right - left)

  // Helper for currency formatting
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CU', { style: 'currency', currency: 'CUP' }).format(amount)
  }

  if (isBlocked) {
    return null
  }

  if (loading && !data) {
    return (
          <div className="flex h-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
    )
  }

  if (!data) {
    return (
          <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
            <p className="text-muted-foreground">
              {errorMsg || "No se pudieron cargar los datos financieros."}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Reintentar
            </button>
          </div>
    )
  }

  return (
        <PageTransition className="space-y-8 p-6">
          <ContabilidadBreadcrumb />
          <StaggerContainer className="space-y-8">
            
            {/* Header Section */}
            <StaggerItem className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                    <Link href="/busy/contabilidad">
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Volver
                    </Link>
                  </Button>
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Reportes Financieros
                </h1>
                <p className="text-muted-foreground">Balance de Comprobación y Estado de Resultados</p>
              </div>
              <div className="w-[180px]">
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="bg-background/50 backdrop-blur-sm">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                   <SelectContent>
                     {yearOptions.map((availableYear) => (
                       <SelectItem key={availableYear} value={String(availableYear)}>
                         {availableYear}
                         {availableYear === new Date().getFullYear() ? ' (provisional)' : ''}
                       </SelectItem>
                     ))}
                   </SelectContent>
                </Select>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div
                className={cn(
                  'rounded-lg border px-4 py-3 text-sm',
                  data.reporte.provisional
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
                )}
                role="status"
              >
                {data.reporte.provisional
                  ? `Reporte provisional. Corte: ${new Date(data.reporte.fechaCorte).toLocaleString('es-CU', { timeZone: ACCOUNTING_TIME_ZONE })}.`
                  : `Snapshot aprobado e íntegro. Balance al ${new Date(data.reporte.fechaCorte).toLocaleString('es-CU', { timeZone: ACCOUNTING_TIME_ZONE })}; resultado hasta ${new Date(data.reporte.resultadoHasta ?? data.reporte.fechaCorte).toLocaleString('es-CU', { timeZone: ACCOUNTING_TIME_ZONE })}.`}
              </div>
            </StaggerItem>

            <StaggerItem>
              <Tabs defaultValue="balance" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-6">
                  <TabsTrigger value="balance">Balance General</TabsTrigger>
                  <TabsTrigger value="resultados">Estado de Resultados</TabsTrigger>
                </TabsList>

                {/* TAB: BALANCE DE COMPROBACIÓN */}
                <TabsContent value="balance" className="space-y-6">
                  <StaggerContainer className="space-y-6" delay={0.1}>
                    <div className="grid gap-4 md:grid-cols-3">
                      <StaggerItem>
                        <AnimatedCard>
                          <Card className={cn(surfaceCardClass)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Total Activos</CardTitle>
                              <Wallet className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{formatMoney(data?.balance.activos.total ?? 0)}</div>
                              <p className="text-xs text-muted-foreground">Recursos controlados por la empresa</p>
                            </CardContent>
                          </Card>
                        </AnimatedCard>
                      </StaggerItem>
                      
                      <StaggerItem>
                        <AnimatedCard>
                          <Card className={cn(surfaceCardClass)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Total Pasivos</CardTitle>
                              <Landmark className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{formatMoney(data?.balance.pasivos.total ?? 0)}</div>
                              <p className="text-xs text-muted-foreground">Obligaciones presentes</p>
                            </CardContent>
                          </Card>
                        </AnimatedCard>
                      </StaggerItem>
                      
                      <StaggerItem>
                        <AnimatedCard>
                          <Card className={cn(surfaceCardClass)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Patrimonio Neto</CardTitle>
                              <Building2 className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{formatMoney(data?.balance.patrimonio.total ?? 0)}</div>
                              <p className="text-xs text-muted-foreground">Valor residual de los activos</p>
                            </CardContent>
                          </Card>
                        </AnimatedCard>
                      </StaggerItem>
                    </div>

                    <StaggerItem>
                      <AnimatedCard>
                        <Card className={cn(surfaceCardClass, "md:col-span-2")}>
                          <CardHeader>
                            <CardTitle>Detalle de Cuentas</CardTitle>
                            <CardDescription>Desglose de la situación financiera actual</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader className="bg-muted/50">
                                <TableRow>
                                  <TableHead>Cuenta</TableHead>
                                  <TableHead>Categoría</TableHead>
                                  <TableHead className="text-right">Saldo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {/* Activos */}
                                <TableRow className="hover:bg-muted/50 transition-colors">
                                  <TableCell className="font-medium">Caja y Bancos</TableCell>
                                  <TableCell>Activo Corriente</TableCell>
                                  <TableCell className="text-right">{formatMoney(data?.balance.activos.efectivo ?? 0)}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-muted/50 transition-colors">
                                  <TableCell className="font-medium">Cuentas por Cobrar</TableCell>
                                  <TableCell>Activo Corriente</TableCell>
                                  <TableCell className="text-right">{formatMoney(data?.balance.activos.cuentasPorCobrar ?? 0)}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-muted/50 transition-colors">
                                  <TableCell className="font-medium">Inventario de Mercancías</TableCell>
                                  <TableCell>Activo Corriente</TableCell>
                                  <TableCell className="text-right">{formatMoney(data?.balance.activos.inventario ?? 0)}</TableCell>
                                </TableRow>
                                <TableRow className="bg-blue-50/50 dark:bg-blue-900/10 font-bold border-t border-blue-200 dark:border-blue-800">
                                  <TableCell colSpan={2}>Total Activos</TableCell>
                                  <TableCell className="text-right">{formatMoney(data?.balance.activos.total ?? 0)}</TableCell>
                                </TableRow>

                                {/* Pasivos */}
                                <TableRow className="hover:bg-muted/50 transition-colors">
                                  <TableCell className="font-medium">Deudas Externas</TableCell>
                                  <TableCell>Pasivo No Corriente</TableCell>
                                  <TableCell className="text-right">{formatMoney(data?.balance.pasivos.deudaExterna ?? 0)}</TableCell>
                                </TableRow>
                                <TableRow className="bg-red-50/50 dark:bg-red-900/10 font-bold border-t border-red-200 dark:border-red-800">
                                  <TableCell colSpan={2}>Total Pasivos</TableCell>
                                  <TableCell className="text-right">{formatMoney(data?.balance.pasivos.total ?? 0)}</TableCell>
                                </TableRow>

                                {/* Patrimonio */}
                                <TableRow className="hover:bg-muted/50 transition-colors">
                                  <TableCell className="font-medium">Capital Social</TableCell>
                                  <TableCell>Patrimonio</TableCell>
                                  <TableCell className="text-right">{formatMoney(data?.balance.patrimonio.capitalSocial ?? 0)}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-muted/50 transition-colors">
                                  <TableCell className="font-medium">Utilidad del Ejercicio</TableCell>
                                  <TableCell>Patrimonio</TableCell>
                                  <TableCell className="text-right">{formatMoney(data?.balance.patrimonio.utilidadEjercicio ?? 0)}</TableCell>
                                </TableRow>
                                <TableRow className="bg-green-50/50 dark:bg-green-900/10 font-bold border-t border-green-200 dark:border-green-800">
                                  <TableCell colSpan={2}>Total Patrimonio</TableCell>
                                  <TableCell className="text-right">{formatMoney(data?.balance.patrimonio.total ?? 0)}</TableCell>
                                </TableRow>
                                
                                <TableRow className="bg-primary/5 font-bold text-lg border-t-2 border-primary">
                                  <TableCell colSpan={2}>Pasivo + Patrimonio</TableCell>
                                  <TableCell className="text-right">{formatMoney((data?.balance.pasivos.total ?? 0) + (data?.balance.patrimonio.total ?? 0))}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </AnimatedCard>
                    </StaggerItem>
                  </StaggerContainer>
                </TabsContent>

                {/* TAB: ESTADO DE RESULTADOS */}
                <TabsContent value="resultados" className="space-y-6">
                  <StaggerContainer className="space-y-6" delay={0.1}>
                    <div className="grid gap-4 md:grid-cols-3">
                      <StaggerItem>
                        <AnimatedCard>
                          <Card className={cn(surfaceCardClass)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{formatMoney(data?.estadoResultados.anual.totalIngresos ?? 0)}</div>
                              <p className="text-xs text-muted-foreground">Ventas + Servicios</p>
                            </CardContent>
                          </Card>
                        </AnimatedCard>
                      </StaggerItem>
                      
                      <StaggerItem>
                        <AnimatedCard>
                          <Card className={cn(surfaceCardClass)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{formatMoney(data?.estadoResultados.anual.totalGastos ?? 0)}</div>
                              <p className="text-xs text-muted-foreground">Operativos + Compras + Nómina</p>
                            </CardContent>
                          </Card>
                        </AnimatedCard>
                      </StaggerItem>
                      
                      <StaggerItem>
                        <AnimatedCard>
                          <Card className={cn(surfaceCardClass)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
                              <DollarSign className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                              <div className={`text-2xl font-bold ${(data?.estadoResultados.anual.utilidadNeta ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatMoney(data?.estadoResultados.anual.utilidadNeta ?? 0)}
                              </div>
                              <p className="text-xs text-muted-foreground">Ganancia final del ejercicio</p>
                            </CardContent>
                          </Card>
                        </AnimatedCard>
                      </StaggerItem>
                    </div>

                    <StaggerItem>
                      <AnimatedCard>
                        <Card className={surfaceCardClass}>
                          <CardHeader>
                            <CardTitle>Rendimiento Mensual</CardTitle>
                            <CardDescription>Comparativa de Ingresos, Gastos y Utilidad Neta</CardDescription>
                          </CardHeader>
                          <CardContent className="h-100">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={data?.estadoResultados.mensual}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="monthName" />
                                <YAxis />
                                <Tooltip 
                                  formatter={(value) => formatMoney(Number(value))}
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="totalIngresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="totalGastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="utilidadNeta" name="Utilidad Neta" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </AnimatedCard>
                    </StaggerItem>

                    <StaggerItem>
                      <AnimatedCard>
                        <Card className={surfaceCardClass}>
                          <CardHeader>
                            <CardTitle>Detalle Mensual</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader className="bg-muted/50">
                                <TableRow>
                                  <TableHead>Mes</TableHead>
                                  <TableHead className="text-right">Ingresos</TableHead>
                                  <TableHead className="text-right">Costo Venta</TableHead>
                                  <TableHead className="text-right">Gastos Op.</TableHead>
                                  <TableHead className="text-right">Utilidad Neta</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {data?.estadoResultados.mensual.map((mes) => (
                                  <TableRow key={mes.month} className="hover:bg-muted/50 transition-colors">
                                    <TableCell className="font-medium capitalize">{mes.monthName}</TableCell>
                                    <TableCell className="text-right text-green-600">{formatMoney(mes.totalIngresos)}</TableCell>
                                    <TableCell className="text-right text-red-400">{formatMoney(mes.ventasCosto)}</TableCell>
                                    <TableCell className="text-right text-red-400">{formatMoney(mes.gastosSalarios + mes.gastosGenerales + mes.gastosMermas)}</TableCell>
                                    <TableCell className={`text-right font-bold ${mes.utilidadNeta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                      {formatMoney(mes.utilidadNeta)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </AnimatedCard>
                    </StaggerItem>
                  </StaggerContainer>
                </TabsContent>
              </Tabs>
            </StaggerItem>
          </StaggerContainer>
        </PageTransition>
  )
}
