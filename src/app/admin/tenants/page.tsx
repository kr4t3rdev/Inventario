'use client'

import { useRef } from "react"
import { Building2, Users, Package, Archive, RefreshCw, Loader2 } from "lucide-react"
import { LazyMotion, m as motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageTransition } from "@/components/ui/animations"
import { useEffect, useState } from "react"
import { getAdminTenantsAction, getAdminSystemHealthAction } from "@/features/admin"

export const dynamic = 'force-dynamic'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const system = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refetch = () => { getAdminTenantsAction().then(r => { if(r.success) setTenants(r.data??[]) }) }
  useEffect(() => { setIsLoading(true); getAdminTenantsAction().then(r => { if(r.success) setTenants(r.data??[]) }); getAdminSystemHealthAction().then(r => { if(r.success) system.current = r.data }); setIsLoading(false) }, [])

  const safeTenants = tenants ?? []

  return (
    <PageTransition className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-purple-600 shadow-lg">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground text-sm">Gestión de empresas y organizaciones</p>
        </div>
        <Button
          onClick={refetch}
          variant="outline"
          disabled={isLoading}
          className="border-slate-200/70 bg-white/70 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
              {isLoading ? "-" : safeTenants.length}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {isLoading ? "-" : safeTenants.reduce((sum, t) => sum + t.totalUsers, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Licencias Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">
              {isLoading ? "-" : safeTenants.filter((t) => t.licenseActive).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tenants table */}
      <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle>Lista de Empresas</CardTitle>
          <CardDescription>Todos los tenants registrados en la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : safeTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No hay tenants registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Empresa</th>
                    <th className="pb-3 pr-4 font-medium">Usuarios</th>
                    <th className="pb-3 pr-4 font-medium">Productos</th>
                    <th className="pb-3 pr-4 font-medium">Almacenes</th>
                    <th className="pb-3 pr-4 font-medium">Plan</th>
                    <th className="pb-3 pr-4 font-medium">Ventas</th>
                    <th className="pb-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {safeTenants.map((t) => (
                    <tr key={t.tenantId} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-medium">{t.nombre}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.activeUsers}/{t.totalUsers}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.totalProductos}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.totalAlmacenes}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.licenseActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        }`}>
                          {t.plan || "Sin plan"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{t.totalVentas}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${
                          t.licenseActive ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            t.licenseActive ? "bg-emerald-500" : "bg-rose-500"
                          }`} />
                          {t.licenseActive ? "Activo" : "Sin licencia"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  )
}
