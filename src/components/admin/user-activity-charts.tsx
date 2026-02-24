'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Sparkles, TrendingUp, UserPlus } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AdminCardsLoader, AdminReveal } from '@/components/admin/animations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetUserMetricsQuery } from '@/lib/redux/services/adminApi';

interface MonthlyData {
  year: number;
  month: string;
  yearMonth: string;
  usersCreated: number;
  activeUsersStart: number;
  activeUsersEnd: number;
  inactiveUsers: number;
  logins: number;
  logouts: number;
  blockedUsers: number;
  newUsersByRole: {
    admin: number;
    dependiente: number;
    regularUser: number;
  };
}

interface MonthlyDataWithRoles extends MonthlyData {
  admin: number;
  dependiente: number;
  regularUser: number;
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
};

/**
 * @description Formatea etiqueta del eje X para mostrar solo el mes en los gráficos.
 * @param {string} value - Valor de eje con formato `YYYY-MM`.
 * @returns {string} Etiqueta abreviada del mes.
 */
function monthTickFormatter(value: string): string {
  const [, month] = value.split('-');
  return month;
}

/**
 * @description Panel de gráficas de actividad de usuarios con animaciones y soporte dark mode.
 * @returns {JSX.Element} Sección de visualización analítica para administración.
 */
export function UserActivityCharts(): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [months, setMonths] = React.useState('6');
  const { data: metrics, isLoading, error } = useGetUserMetricsQuery({
    months: Number.parseInt(months, 10),
  });

  const chartData = React.useMemo<MonthlyDataWithRoles[]>(() => {
    const rows = (metrics?.monthlyData || []) as MonthlyData[];
    return rows.map((row) => ({
      ...row,
      admin: row.newUsersByRole?.admin || 0,
      dependiente: row.newUsersByRole?.dependiente || 0,
      regularUser: row.newUsersByRole?.regularUser || 0,
    }));
  }, [metrics]);

  return (
    <div className="space-y-6">
      <AdminReveal>
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-md">
              <TrendingUp className="h-5 w-5 text-white" />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <h3 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-lg font-semibold text-transparent dark:from-white dark:to-slate-300">
                Gráficos de Actividad de Usuarios
              </h3>
              <p className="text-sm text-muted-foreground">
                Histórico de actividad, nuevos usuarios y métricas de seguridad.
              </p>
            </div>
          </div>
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
              <SelectItem value="18">18 meses</SelectItem>
              <SelectItem value="24">24 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </AdminReveal>

      {isLoading ? (
        <div className="space-y-4">
          <AdminCardsLoader cards={3} className="lg:grid-cols-3" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card
                key={`chart-loader-${index}`}
                className="border bg-card"
              >
                <CardContent className="p-6">
                  <Skeleton className="mb-3 h-5 w-40 animate-pulse-subtle" />
                  <Skeleton className="h-[280px] w-full animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : error ? (
        <Card className="border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              Error al cargar los datos: {error.toString()}
            </p>
          </CardContent>
        </Card>
      ) : chartData.length === 0 ? (
        <Card className="border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              No hay datos disponibles para el período seleccionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
        >
          <motion.div
            className="col-span-2"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.28, delay: 0.04 }}
          >
            <Card className="h-full border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Logins vs Logouts</CardTitle>
                <CardDescription>Actividad de inicio y cierre de sesión.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 10 }}>
                      <defs>
                        <linearGradient id="users-login-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.72} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.08} />
                        </linearGradient>
                        <linearGradient id="users-logout-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.72} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.08} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" />
                      <XAxis
                        dataKey="yearMonth"
                        tickLine={false}
                        tickMargin={8}
                        axisLine={false}
                        tickFormatter={monthTickFormatter}
                      />
                      <YAxis tickLine={false} axisLine={false} />
                      <Legend verticalAlign="top" height={36} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'Login') {
                            return `${value} logins`;
                          }
                          return `${value} logouts`;
                        }}
                        contentStyle={CHART_TOOLTIP_STYLE}
                      />
                      <Area
                        type="monotone"
                        name="Login"
                        dataKey="logins"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="url(#users-login-gradient)"
                        fillOpacity={0.7}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={650}
                      />
                      <Area
                        type="monotone"
                        name="Logout"
                        dataKey="logouts"
                        stroke="#ef4444"
                        strokeWidth={2}
                        fill="url(#users-logout-gradient)"
                        fillOpacity={0.65}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={650}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.28, delay: 0.08 }}
          >
            <Card className="h-full border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Usuarios Activos vs Inactivos</CardTitle>
                <CardDescription>
                  Evolución de usuarios activos e inactivos por período.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 10 }}>
                      <defs>
                        <linearGradient id="users-active-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.82} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.18} />
                        </linearGradient>
                        <linearGradient id="users-inactive-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6b7280" stopOpacity={0.82} />
                          <stop offset="95%" stopColor="#6b7280" stopOpacity={0.18} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="yearMonth"
                        tickLine={false}
                        tickMargin={8}
                        axisLine={false}
                        tickFormatter={monthTickFormatter}
                      />
                      <YAxis tickLine={false} axisLine={false} />
                      <Legend verticalAlign="top" height={36} />
                      <Tooltip
                        formatter={(value: number) => `${value} usuarios`}
                        contentStyle={CHART_TOOLTIP_STYLE}
                      />
                      <Bar
                        dataKey="activeUsersEnd"
                        name="Activos"
                        fill="url(#users-active-gradient)"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={620}
                      />
                      <Bar
                        dataKey="inactiveUsers"
                        name="Inactivos"
                        fill="url(#users-inactive-gradient)"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={620}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.28, delay: 0.12 }}
          >
            <Card className="h-full border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                  Usuarios Bloqueados
                </CardTitle>
                <CardDescription>Usuarios bloqueados por intentos fallidos.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 10 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="yearMonth"
                        tickLine={false}
                        tickMargin={8}
                        axisLine={false}
                        tickFormatter={monthTickFormatter}
                      />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number) => `${value} bloqueados`}
                        contentStyle={CHART_TOOLTIP_STYLE}
                      />
                      <Bar
                        dataKey="blockedUsers"
                        name="Bloqueados"
                        fill="#ef4444"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={620}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.28, delay: 0.16 }}
          >
            <Card className="h-full border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                  Nuevos Usuarios por Rol
                </CardTitle>
                <CardDescription>Distribución mensual de altas por rol.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 10 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="yearMonth"
                        tickLine={false}
                        tickMargin={8}
                        axisLine={false}
                        tickFormatter={monthTickFormatter}
                      />
                      <YAxis tickLine={false} axisLine={false} />
                      <Legend verticalAlign="top" height={36} />
                      <Tooltip
                        formatter={(value: number) => `${value} usuarios nuevos`}
                        contentStyle={CHART_TOOLTIP_STYLE}
                      />
                      <Bar
                        dataKey="admin"
                        name="Admin"
                        fill="#3b82f6"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={600}
                      />
                      <Bar
                        dataKey="dependiente"
                        name="Dependiente"
                        fill="#f59e0b"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={600}
                      />
                      <Bar
                        dataKey="regularUser"
                        name="Usuario"
                        fill="#6b7280"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={600}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.28, delay: 0.2 }}
          >
            <Card className="h-full border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  Usuarios Creados
                </CardTitle>
                <CardDescription>Nuevos usuarios creados por período.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 10 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" />
                      <XAxis
                        dataKey="yearMonth"
                        tickLine={false}
                        tickMargin={8}
                        axisLine={false}
                        tickFormatter={monthTickFormatter}
                      />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number) => `${value} usuarios nuevos`}
                        contentStyle={CHART_TOOLTIP_STYLE}
                      />
                      <Line
                        type="monotone"
                        dataKey="usersCreated"
                        stroke="#22c55e"
                        strokeWidth={2.4}
                        dot={false}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={640}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
