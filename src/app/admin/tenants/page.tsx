'use client'

import { useRef } from "react"
import { Building2, Users, Package, Archive, RefreshCw, Loader2, Search, MoreVertical, Eye, Edit, Ban, CheckCircle } from "lucide-react"
import { LazyMotion, m as motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { PageTransition } from "@/components/ui/animations"
import { useEffect, useState } from "react"
import { getAdminTenantsAction, getAdminSystemHealthAction } from "@/features/admin"

export const dynamic = 'force-dynamic'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const system = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterByLicense, setFilterByLicense] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'users' | 'created'>('name')
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const refetch = () => { getAdminTenantsAction().then(r => { if(r.success) setTenants(r.data??[]) }) }
  useEffect(() => { setIsLoading(true); getAdminTenantsAction().then(r => { if(r.success) setTenants(r.data??[]) }); getAdminSystemHealthAction().then(r => { if(r.success) system.current = r.data }); setIsLoading(false) }, [])

  const safeTenants = tenants ?? []

  // Filtrar y ordenar tenants
  const filteredTenants = safeTenants
    .filter(t => {
      // Búsqueda por nombre
      if (searchQuery && !t.nombre.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Filtro por licencia
      if (filterByLicense === 'active' && !t.licenseActive) return false;
      if (filterByLicense === 'inactive' && t.licenseActive) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.nombre.localeCompare(b.nombre);
      if (sortBy === 'users') return b.totalUsers - a.totalUsers;
      if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });

  const openDetails = (tenant: any) => {
    setSelectedTenant(tenant);
    setIsDetailsOpen(true);
  };


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

      
      {/* Search and Filters */}
      <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterByLicense}
                onChange={(e) => setFilterByLicense(e.target.value as any)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todas las licencias</option>
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="name">Ordenar por nombre</option>
                <option value="users">Ordenar por usuarios</option>
                <option value="created">Ordenar por fecha</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

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
          ) : filteredTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {searchQuery || filterByLicense !== 'all' ? 'No se encontraron tenants con los filtros aplicados' : 'No hay tenants registrados'}
            </p>
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
                    <th className="pb-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((t) => (
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
                      <td className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetails(t)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-rose-600">
                              <Ban className="mr-2 h-4 w-4" />
                              Suspender
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    
      {/* Tenant Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-violet-600" />
              {selectedTenant?.nombre}
            </DialogTitle>
            <DialogDescription>
              Detalles y métricas del tenant
            </DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-6">
              {/* Info básica */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ID</p>
                  <p className="text-sm font-mono">{selectedTenant.tenantId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Creado</p>
                  <p className="text-sm">{new Date(selectedTenant.createdAt).toLocaleDateString('es-CU')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plan</p>
                  <Badge variant={selectedTenant.licenseActive ? "default" : "destructive"}>
                    {selectedTenant.plan || "Sin plan"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Estado</p>
                  <Badge variant={selectedTenant.licenseActive ? "default" : "secondary"}>
                    {selectedTenant.licenseActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-violet-600">{selectedTenant.totalUsers}</p>
                    <p className="text-xs text-muted-foreground">{selectedTenant.activeUsers} activos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Productos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-emerald-600">{selectedTenant.totalProductos}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ventas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-sky-600">{selectedTenant.totalVentas}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Consumo vs límites */}
              <div>
                <h4 className="text-sm font-medium mb-2">Consumo de recursos</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Usuarios</span>
                    <span className="text-sm font-medium">{selectedTenant.totalUsers} / {selectedTenant.consumption?.usuarios || '∞'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Productos</span>
                    <span className="text-sm font-medium">{selectedTenant.totalProductos} / {selectedTenant.consumption?.productos || '∞'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Almacenes</span>
                    <span className="text-sm font-medium">{selectedTenant.totalAlmacenes} / {selectedTenant.consumption?.almacenes || '∞'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </PageTransition>
  )
}
