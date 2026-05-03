'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Lock,
  PieChart as PieChartIcon,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AdminCardsLoader, AdminReveal } from '@/components/admin/animations';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetUserMetricsQuery } from '@/lib/redux/services/adminApi';

interface TemporalDashboardProps {
  months?: number;
}

type DashboardMetric = 'overview' | 'growth' | 'activity' | 'roles';

interface MonthlyMetrics {
  month: string;
  year: number;
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
    legacyUser: number;
  };
}

interface MonthlyMetricsWithDerived extends MonthlyMetrics {
  admin: number;
  dependiente: number;
  legacyUser: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
};

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#6b7280'];

/**
 * @description Formatea el eje temporal para mostrar solo el mes.
 * @param {string} value - Valor con formato `YYYY-MM`.
 * @returns {string} Nombre corto del mes.
 */
function monthTickFormatter(value: string): string {
  const [, month] = value.split('-');
  return month;
}

/**
 * @description Calcula el porcentaje de crecimiento entre dos valores.
 * @param {number} current - Valor actual.
 * @param {number} previous - Valor del periodo anterior.
 * @returns {number} Porcentaje de crecimiento.
 */
function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * @description Dashboard temporal de métricas con vistas analíticas y animaciones.
 * @param {TemporalDashboardProps} props - Propiedades iniciales del dashboard.
 * @returns {JSX.Element} Panel temporal con KPIs y gráficos.
 */
export function TemporalDashboard({ months: initialMonths = 6 }: TemporalDashboardProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [months, setMonths] = React.useState(initialMonths.toString());
  const [selectedMetric, setSelectedMetric] = React.useState<DashboardMetric>('overview');

  const { data: metrics, isLoading, error } = useGetUserMetricsQuery({
    months: Number.parseInt(months, 10),
  });

  const chartData = React.useMemo<MonthlyMetricsWithDerived[]>(() => {
    const monthly = (metrics?.monthlyData || []) as MonthlyMetrics[];
    return monthly.map((entry) => ({
      ...entry,
      admin: entry.newUsersByRole?.admin || 0,
      dependiente: entry.newUsersByRole?.dependiente || 0,
      legacyUser: entry.newUsersByRole?.legacyUser || 0,
    }));
  }, [metrics]);

  const latest = chartData[chartData.length - 1];
  const previous = chartData[chartData.length - 2];

  const roleDistribution = React.useMemo(() => {
    if (!latest) {
      return [];
    }
    return [
      { name: 'Admin', value: latest.admin },
      { name: 'Dependiente', value: latest.dependiente },
      { name: 'Usuario legado', value: latest.legacyUser },
    ];
  }, [latest]);

  const monthlyGrowth = React.useMemo(() => {
    return chartData.map((entry, index) => {
      if (index === 0) {
        return { ...entry, growth: 0 };
      }
      const previousEntry = chartData[index - 1];
      return {
        ...entry,
        growth: calculateGrowth(entry.usersCreated, previousEntry.usersCreated),
      };
    });
  }, [chartData]);

  const userGrowth = previous && latest
    ? calculateGrowth(latest.activeUsersEnd, previous.activeUsersEnd)
    : 0;
  const createdGrowth = previous && latest
    ? calculateGrowth(latest.usersCreated, previous.usersCreated)
    : 0;
  const loginGrowth = previous && latest
    ? calculateGrowth(latest.logins, previous.logins)
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between dark:border-slate-700/40 dark:bg-slate-900/65">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 shadow-md">
              <BarChart3 className="h-5 w-5 text-white" />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <h3 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-lg font-semibold text-transparent dark:from-white dark:to-slate-300">
                Dashboard Temporal
              </h3>
              <p className="text-sm text-muted-foreground">Métricas mensuales y tendencias.</p>
            </div>
          </div>
          <Skeleton className="h-10 w-40 animate-pulse-subtle" />
        </div>
        <AdminCardsLoader cards={4} />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border bg-card">
            <CardContent className="p-6">
              <Skeleton className="mb-4 h-5 w-52 animate-pulse-subtle" />
              <Skeleton className="h-82.5 w-full animate-pulse" />
            </CardContent>
          </Card>
          <Card className="border bg-card">
            <CardContent className="p-6">
              <Skeleton className="mb-4 h-5 w-52 animate-pulse-subtle" />
              <Skeleton className="h-82.5 w-full animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-rose-600 dark:text-rose-400">
            Error al cargar los datos: {error.toString()}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!chartData.length) {
    return (
      <Card className="border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            No hay datos disponibles para el período seleccionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AdminReveal>
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between dark:border-slate-700/40 dark:bg-slate-900/65">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 shadow-md">
              <BarChart3 className="h-5 w-5 text-white" />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <h3 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-lg font-semibold text-transparent dark:from-white dark:to-slate-300">
                Dashboard Temporal
              </h3>
              <p className="text-sm text-muted-foreground">
                Métricas mensuales y tendencias de crecimiento.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as DashboardMetric)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Vista General</SelectItem>
                <SelectItem value="growth">Crecimiento</SelectItem>
                <SelectItem value="activity">Actividad</SelectItem>
                <SelectItem value="roles">Roles</SelectItem>
              </SelectContent>
            </Select>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger className="w-full sm:w-36">
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
        </div>
      </AdminReveal>

      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.28 }}
      >
        {[
          {
            title: 'Usuarios Totales',
            value: latest.activeUsersEnd,
            icon: Users,
            growth: userGrowth,
          },
          {
            title: 'Nuevos Usuarios',
            value: latest.usersCreated,
            icon: UserPlus,
            growth: createdGrowth,
          },
          {
            title: 'Tasa de Actividad',
            value:
              latest.activeUsersEnd + latest.inactiveUsers > 0
                ? Number(
                    ((latest.activeUsersEnd /
                      (latest.activeUsersEnd + latest.inactiveUsers)) *
                      100).toFixed(1),
                  )
                : 0,
            icon: Activity,
            growth: null,
            suffix: '%',
            subtitle: 'Usuarios activos del total',
          },
          {
            title: 'Logins Totales',
            value: latest.logins,
            icon: Target,
            growth: loginGrowth,
          },
        ].map((item, index) => {
          const Icon = item.icon;
          const hasGrowth = typeof item.growth === 'number';
          const growthValue = hasGrowth ? item.growth : 0;
          const isPositive = growthValue >= 0;

          return (
            <motion.div
              key={item.title}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.26, delay: index * 0.05 }}
            >
              <Card className="h-full border bg-card shadow-sm ">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {item.value}
                    {item.suffix || ''}
                  </div>
                  {hasGrowth ? (
                    <div className="flex items-center text-xs text-muted-foreground">
                      {isPositive ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-rose-500 dark:text-rose-400" />
                      )}
                      <span
                        className={
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      >
                        {Math.abs(growthValue).toFixed(1)}%
                      </span>
                      <span className="ml-1">vs mes anterior</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedMetric}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.24 }}
          className="space-y-4"
        >
          {selectedMetric === 'overview' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="col-span-2 border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Evolución de Usuarios
                  </CardTitle>
                  <CardDescription>
                    Creación y actividad de usuarios a lo largo del tiempo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-100">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 10 }}>
                        <defs>
                          <linearGradient id="temporal-active-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                          </linearGradient>
                          <linearGradient id="temporal-created-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
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
                          formatter={(value: number, name: string) => {
                            if (name === 'Activos') {
                              return `${value} usuarios activos`;
                            }
                            if (name === 'Creados') {
                              return `${value} usuarios nuevos`;
                            }
                            return value;
                          }}
                          contentStyle={TOOLTIP_STYLE}
                        />
                        <Area
                          type="monotone"
                          name="Activos"
                          dataKey="activeUsersEnd"
                          stroke="#22c55e"
                          strokeWidth={2}
                          fill="url(#temporal-active-gradient)"
                          fillOpacity={0.62}
                          isAnimationActive={!shouldReduceMotion}
                          animationDuration={620}
                        />
                        <Area
                          type="monotone"
                          name="Creados"
                          dataKey="usersCreated"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#temporal-created-gradient)"
                          fillOpacity={0.62}
                          isAnimationActive={!shouldReduceMotion}
                          animationDuration={620}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-primary" />
                    Distribución de Roles
                  </CardTitle>
                  <CardDescription>Nuevos usuarios por rol en el último mes.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-75">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={roleDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={84}
                          labelLine={false}
                          dataKey="value"
                          label={({
                            name,
                            percent,
                          }: {
                            name: string;
                            percent?: number;
                          }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          isAnimationActive={!shouldReduceMotion}
                          animationDuration={620}
                        >
                          {roleDistribution.map((entry, index) => (
                            <Cell
                              key={`role-cell-${entry.name}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => `${value} usuarios`}
                          contentStyle={TOOLTIP_STYLE}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle>Resumen de Actividad</CardTitle>
                  <CardDescription>Métricas clave del último mes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {latest.logins}
                      </div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-300">Logins</div>
                    </div>
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-center">
                      <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                        {latest.logouts}
                      </div>
                      <div className="text-xs text-rose-700 dark:text-rose-300">Logouts</div>
                    </div>
                    <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-center">
                      <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                        {latest.activeUsersEnd}
                      </div>
                      <div className="text-xs text-sky-700 dark:text-sky-300">Activos</div>
                    </div>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {latest.inactiveUsers}
                      </div>
                      <div className="text-xs text-amber-700 dark:text-amber-300">Inactivos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {selectedMetric === 'growth' && (
            <Card className="border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Tasa de Crecimiento Mensual</CardTitle>
                <CardDescription>
                  Porcentaje de crecimiento de nuevos usuarios.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-100">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyGrowth} margin={{ top: 20, right: 24, left: 8, bottom: 10 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" />
                      <XAxis
                        dataKey="yearMonth"
                        tickLine={false}
                        tickMargin={8}
                        axisLine={false}
                        tickFormatter={monthTickFormatter}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                        contentStyle={TOOLTIP_STYLE}
                      />
                      <Line
                        type="monotone"
                        dataKey="growth"
                        stroke="#22c55e"
                        strokeWidth={2.4}
                        dot={{ fill: '#22c55e', strokeWidth: 2 }}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={640}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedMetric === 'activity' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle>Actividad de Sesión</CardTitle>
                  <CardDescription>Logins vs Logouts mensuales.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-87.5">
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
                          formatter={(value: number, name: string) => `${value} ${name.toLowerCase()}`}
                          contentStyle={TOOLTIP_STYLE}
                        />
                        <Bar
                          dataKey="logins"
                          name="Logins"
                          fill="#22c55e"
                          radius={[8, 8, 0, 0]}
                          isAnimationActive={!shouldReduceMotion}
                          animationDuration={620}
                        />
                        <Bar
                          dataKey="logouts"
                          name="Logouts"
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

              <Card className="border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                    Usuarios Bloqueados
                  </CardTitle>
                  <CardDescription>
                    Tendencia de usuarios bloqueados por seguridad.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-87.5">
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
                          formatter={(value: number) => `${value} bloqueados`}
                          contentStyle={TOOLTIP_STYLE}
                        />
                        <Line
                          type="monotone"
                          dataKey="blockedUsers"
                          stroke="#ef4444"
                          strokeWidth={2.4}
                          dot={{ fill: '#ef4444', strokeWidth: 2 }}
                          isAnimationActive={!shouldReduceMotion}
                          animationDuration={640}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {selectedMetric === 'roles' && (
            <Card className="border bg-card shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Evolución de Roles</CardTitle>
                    <CardDescription>
                      Creación de usuarios por rol a lo largo del tiempo.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    {chartData.length} periodos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-100">
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
                        formatter={(value: number, name: string) => `${value} ${name.toLowerCase()}`}
                        contentStyle={TOOLTIP_STYLE}
                      />
                      <Bar
                        dataKey="admin"
                        name="Admin"
                        fill="#3b82f6"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={620}
                      />
                      <Bar
                        dataKey="dependiente"
                        name="Dependiente"
                        fill="#f59e0b"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={620}
                      />
                      <Bar
                        dataKey="legacyUser"
                        name="Usuario legado"
                        fill="#6b7280"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={620}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
