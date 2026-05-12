'use client'

import { Activity, Sparkles, Shield, Clock, Loader2, RefreshCw } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageTransition } from "@/components/ui/animations"
import { useEffect, useState } from "react"
import { getAdminSystemHealthAction } from "@/features/admin"

export const dynamic = 'force-dynamic'

export default function SistemaPage() {
  const [system, setSystem] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const safeSystem = system ?? { users: { total: 0, byRole: [] }, tenants: { total: 0 }, sessions: { active: 0 }, licenses: { total: 0, active: 0, expiringSoon: 0 } }
  const refetch = () => { getAdminSystemHealthAction().then(r => { if(r.success) setSystem(r.data) }) }
  useEffect(() => { setIsLoading(true); getAdminSystemHealthAction().then(r => { if(r.success) setSystem(r.data); setIsLoading(false) }) }, [])

  return (
    <PageTransition className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-purple-600 shadow-lg">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Salud del Sistema</h1>
          <p className="text-muted-foreground text-sm">Métricas de infraestructura y sesiones activas</p>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios Totales</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold">{safeSystem.users.total}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {safeSystem.users.byRole.find((r) => r.role === "admin")?.count ?? 0} admins
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sesiones Activas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{safeSystem.sessions.active}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Usuarios conectados ahora</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Licencias Activas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">{safeSystem.licenses.active}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">de {safeSystem.licenses.total} totales</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Por Vencer</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
                <p className={`text-3xl font-bold ${safeSystem.licenses.expiringSoon > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {safeSystem.licenses.expiringSoon}
                </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Próximos 30 días</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-violet-600" />
              Distribución de Roles
            </CardTitle>
            <CardDescription>Usuarios del sistema por tipo de rol</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {safeSystem.users.byRole.map((r: any) => {
                  const pct = safeSystem.users.total > 0
                    ? Math.round((r.count / safeSystem.users.total) * 100)
                    : 0
                  const colors: Record<string, string> = {
                    admin: "bg-violet-500",
                    manager: "bg-blue-500",
                    regularUser: "bg-slate-500",
                    economico: "bg-amber-500",
                  }
                  return (
                    <div key={r.role} className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{r.role}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${colors[r.role] ?? "bg-slate-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-12 text-right">{r.count}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-600" />
              Estado de Licencias
            </CardTitle>
            <CardDescription>Resumen de licencias en la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Activas", value: safeSystem.licenses.active, color: "bg-emerald-500", total: safeSystem.licenses.total },
                  { label: "Por vencer (30d)", value: safeSystem.licenses.expiringSoon, color: "bg-amber-500", total: safeSystem.licenses.total },
                  { label: "Inactivas", value: safeSystem.licenses.total - safeSystem.licenses.active, color: "bg-rose-500", total: safeSystem.licenses.total },
                ].map((item) => {
                  const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0
                  return (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${item.color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{item.value}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
