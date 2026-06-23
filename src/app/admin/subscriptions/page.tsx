"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Repeat,
  AlertCircle,
  RefreshCw,
  Calendar,
  Award,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/animations";
import { getAdminSubscriptionRevenueAction } from "@/features/admin";
import type { AdminSubscriptionRevenue } from "@/features/admin";

export default function SubscriptionsRevenuePage() {
  const [revenue, setRevenue] = useState<AdminSubscriptionRevenue | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRevenue = async () => {
    setIsLoading(true);
    try {
      const result = await getAdminSubscriptionRevenueAction();
      if (result.success && result.data) {
        setRevenue(result.data);
      }
    } catch (error) {
      console.error("Error fetching subscription revenue:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, []);

  if (isLoading || !revenue) {
    return (
      <PageTransition className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageTransition>
    );
  }

  const kpiCards = [
    {
      title: "MRR",
      value: `$${revenue.mrr.toLocaleString()}`,
      description: "Ingresos recurrentes mensuales",
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "from-emerald-600/15 to-green-600/15",
    },
    {
      title: "ARR",
      value: `$${revenue.arr.toLocaleString()}`,
      description: "Proyección anual",
      icon: TrendingUp,
      color: "text-violet-600 dark:text-violet-400",
      bg: "from-violet-600/15 to-purple-600/15",
    },
    {
      title: "Churn Rate",
      value: `${revenue.churnRate}%`,
      description: "Cancelaciones últimos 30 días",
      icon: TrendingDown,
      color: revenue.churnRate > 5 ? "text-rose-600" : "text-emerald-600",
      bg: revenue.churnRate > 5 ? "from-rose-600/15" : "from-emerald-600/15",
    },
    {
      title: "LTV",
      value: `$${revenue.ltv.toLocaleString()}`,
      description: "Valor de vida del cliente",
      icon: Award,
      color: "text-sky-600 dark:text-sky-400",
      bg: "from-sky-600/15 to-blue-600/15",
    },
    {
      title: "Licencias Activas",
      value: revenue.activeLicenses.toString(),
      description: `${revenue.inactiveLicenses} inactivas`,
      icon: Users,
      color: "text-violet-600",
      bg: "from-violet-600/15 to-purple-600/15",
    },
    {
      title: "Ingreso Promedio",
      value: `$${revenue.avgRevenuePerTenant.toLocaleString()}`,
      description: "Por tenant/mes",
      icon: Repeat,
      color: "text-amber-600",
      bg: "from-amber-600/15 to-orange-600/15",
    },
  ];

  return (
    <PageTransition className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 shadow-lg">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Revenue de Suscripciones</h1>
            <p className="text-muted-foreground text-sm">
              Ingresos basados en licencias activas y precios de planes
            </p>
          </div>
        </div>
        <Button
          onClick={fetchRevenue}
          variant="outline"
          disabled={isLoading}
          className="border-slate-200/70 bg-white/70 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Info banner */}
      <Card className="rounded-xl border bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Cálculo basado en licencias activas
              </p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                El MRR se calcula multiplicando el precio de cada plan por las licencias activas,
                normalizado a mensual. La decisión de pago real queda en el sistema contable.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 mt-4">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <div className={`rounded-md bg-gradient-to-br ${card.bg} p-2`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent className="mb-4">
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue by Plan */}
        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-violet-600" />
              Distribución de Ingresos por Plan
            </CardTitle>
            <CardDescription>Cuánto genera cada plan mensualmente</CardDescription>
          </CardHeader>
          <CardContent>
            {revenue.revenueByPlan.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No hay licencias activas
              </p>
            ) : (
              <div className="space-y-3">
                {revenue.revenueByPlan.map((plan) => {
                  const percentage = revenue.mrr > 0 
                    ? Math.round((plan.mrr / revenue.mrr) * 100) 
                    : 0;
                  return (
                    <div key={plan.planId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{plan.nombre}</span>
                          <Badge variant="secondary" className="text-xs">
                            {plan.tenants} {plan.tenants === 1 ? "tenant" : "tenants"}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">${plan.mrr.toLocaleString()}/mes</p>
                          <p className="text-xs text-muted-foreground">{percentage}% del MRR</p>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projected Revenue */}
        <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-amber-600" />
              Ingresos Proyectados
            </CardTitle>
            <CardDescription>Próximos 30 días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Renovaciones esperadas</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      ${revenue.projectedRevenue.fromExpiring.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Licencias por vencer</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {revenue.projectedRevenue.expiringCount}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Nuevas licencias este mes</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {revenue.projectedRevenue.fromNew}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-emerald-600" />
                </div>
              </div>

              <div className="rounded-lg border bg-violet-50/50 dark:bg-violet-950/10 p-4">
                <p className="text-xs text-muted-foreground">Ingreso total proyectado</p>
                <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                  ${(revenue.projectedRevenue.fromExpiring + (revenue.projectedRevenue.fromNew * (revenue.mrr / Math.max(revenue.activeLicenses, 1)))).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Renovaciones + nuevas licencias del mes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* License History (últimos 6 meses) */}
      <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-violet-600" />
            Histórico de Licencias (Últimos 6 meses)
          </CardTitle>
          <CardDescription>
            Nuevas licencias, renovaciones e ingresos por mes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {revenue.licenseHistory.map((mes) => (
              <div
                key={mes.mes}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium w-24">{mes.mes}</div>
                  <div className="flex gap-2">
                    <Badge className="bg-emerald-500">
                      +{mes.nuevasLicencias} nuevas
                    </Badge>
                    <Badge variant="secondary">
                      {mes.renovaciones} renovaciones
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">
                    ${mes.ingresos.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Ingresos del mes</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Churn Analysis */}
      {revenue.churnRate > 0 && (
        <Card className="rounded-xl border bg-rose-50/50 dark:bg-rose-950/10 border-rose-200/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4" />
              Análisis de Churn
            </CardTitle>
            <CardDescription className="text-rose-600 dark:text-rose-400">
              Tasa de cancelación: {revenue.churnRate}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-rose-700 dark:text-rose-300">
              En los últimos 30 días, se han cancelado {Math.round((revenue.churnRate / 100) * (revenue.activeLicenses + Math.round((revenue.churnRate / 100) * revenue.activeLicenses)))} licencias.
              {revenue.churnRate > 5 && (
                <span className="block mt-2 font-medium">
                  ⚠️ Tasa de churn elevada. Considere estrategias de retención.
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </PageTransition>
  );
}
