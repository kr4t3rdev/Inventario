import Link from 'next/link';
import {
  ArrowUpDown,
  Banknote,
  Building2,
  CreditCard,
  DollarSign,
  FileText,
  Receipt,
  Settings,
  SlidersHorizontal,
  ChevronRight,
  PieChart
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from '@/components/ui/animations';
import { cn } from '@/lib/utils';
import { canAccessAccountingItem } from '@/lib/plan-access';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { DeudasCashStatsWidget } from '@/features/contabilidad/components/deudas-cash-stats-widget';
import { AccountingHealthCard } from '@/features/contabilidad/components/accounting-health-card';
import { ResumenFinancieroServer } from './resumen-financiero-server';

/** @description Skeleton del resumen financiero mientras el servidor resuelve el panel. */
export function ResumenSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
           <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
           <div className="h-8 w-64 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
           <div className="h-4 w-96 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
           <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
           <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse" />
        ))}
      </div>
       {/* Secondary Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// --- Style Configurations ---
const accentStyles = {
  blue: {
    gradient: 'from-blue-500/20 via-blue-500/5 to-transparent dark:from-blue-400/20 dark:via-blue-400/5',
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    border: 'group-hover:border-blue-500/50 dark:group-hover:border-blue-400/50',
  },
  emerald: {
    gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent dark:from-emerald-400/20 dark:via-emerald-400/5',
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    border: 'group-hover:border-emerald-500/50 dark:group-hover:border-emerald-400/50',
  },
  purple: {
    gradient: 'from-purple-500/20 via-purple-500/5 to-transparent dark:from-purple-400/20 dark:via-purple-400/5',
    icon: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    border: 'group-hover:border-purple-500/50 dark:group-hover:border-purple-400/50',
  },
  amber: {
    gradient: 'from-amber-500/20 via-amber-500/5 to-transparent dark:from-amber-400/20 dark:via-amber-400/5',
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    border: 'group-hover:border-amber-500/50 dark:group-hover:border-amber-400/50',
  },
  orange: {
    gradient: 'from-orange-500/20 via-orange-500/5 to-transparent dark:from-orange-400/20 dark:via-orange-400/5',
    icon: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    border: 'group-hover:border-orange-500/50 dark:group-hover:border-orange-400/50',
  },
  slate: {
    gradient: 'from-slate-500/20 via-slate-500/5 to-transparent dark:from-slate-400/20 dark:via-slate-400/5',
    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    border: 'group-hover:border-slate-400/50 dark:group-hover:border-slate-500/50',
  },
} as const;

type AccentTone = keyof typeof accentStyles;

const quickActionsBase = [
  { title: 'Cuentas Bancarias', description: 'Gestión de saldos y cuentas', href: '/busy/contabilidad/cuentas', icon: Building2, tone: 'blue' },
  { title: 'Reconciliación', description: 'Conciliar movimientos pendientes', href: '/busy/contabilidad/reconciliacion', icon: Receipt, tone: 'emerald' },
  { title: 'Transferencias', description: 'Mover fondos entre cuentas', href: '/busy/contabilidad/transferencias', icon: ArrowUpDown, tone: 'purple' },
  { title: 'Préstamos en Efectivo', description: 'Préstamos cash a clientes', href: '/busy/contabilidad/prestamos-cash', icon: DollarSign, tone: 'emerald' },
  { title: 'Deudas en Efectivo', description: 'Deudas cash con proveedores', href: '/busy/contabilidad/deudas-cash', icon: CreditCard, tone: 'orange' },
  { title: 'Tasas de Cambio', description: 'Configurar valores de monedas', href: '/busy/contabilidad/exchange', icon: Banknote, tone: 'orange' },
  { title: 'Ajustes Manuales', description: 'Correcciones y notas de débito/crédito', href: '/busy/contabilidad/ajustes', icon: SlidersHorizontal, tone: 'amber' },
  { title: 'Auditoría', description: 'Historial de operaciones', href: '/busy/contabilidad/logs', icon: FileText, tone: 'slate' },
] satisfies Array<{
  title: string;
  description: string;
  href: string;
  icon: typeof Building2;
  tone: AccentTone;
}>;

/**
 * @description Dashboard principal de contabilidad. Server Component: el encabezado,
 * la navegación y los accesos rápidos se renderizan en el servidor; el resumen
 * financiero se precarga server-side y queda interactivo en cliente.
 * @returns {Promise<JSX.Element>} Vista del dashboard de contabilidad.
 */
export default async function ContabilidadDashboard(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  const hasContabilidad = user?.planFeatures?.contabilidad === true;
  const hideItemForBasic = (title: string) => !canAccessAccountingItem(user, title);

  const quickActions = quickActionsBase.filter((a) => {
    if (a.title === 'Transferencias' && hideItemForBasic('Transferencias Bancarias')) return false;
    if (a.title === 'Ajustes Manuales' && hideItemForBasic('Ajustes Bancarios')) return false;
    if (a.title === 'Tasas de Cambio' && hideItemForBasic('Exchange')) return false;
    if (a.title === 'Auditoría' && !hasContabilidad) return false;
    return true;
  });

  return (
    <PageTransition className="relative min-h-screen w-full">
      {user?.role === 'admin' ? <AccountingHealthCard userRole={user.role} /> : null}

      <StaggerContainer className="container mx-auto p-6 space-y-10">
        {/* Header */}
        <StaggerItem className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Contabilidad
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
              Gestión financiera integral, control de cuentas y conciliación bancaria.
            </p>
          </div>

          <div className="flex gap-3">
            {!hideItemForBasic('Reportes Contables') && hasContabilidad && (
              <Button
                asChild
                variant="outline"
                className="border-slate-200 hover:bg-slate-100  dark:hover:bg-slate-800"
              >
                <Link href="/busy/contabilidad/reportes" className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Reportes
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Link href="/busy/contabilidad/configuracion" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuración
              </Link>
            </Button>
          </div>
        </StaggerItem>

        {/* Resumen Financiero — prefetch en el servidor, interactivo en cliente.
            Sin Suspense: un boundary aquí re-muestra el skeleton cada vez que un
            widget cliente ejecuta una server action (Next re-renderiza la ruta). */}
        <StaggerItem>
          <ResumenFinancieroServer />
        </StaggerItem>

        {/* Deudas Cash Stats Widget */}
        {process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false' && (
          <StaggerItem>
            <DeudasCashStatsWidget />
          </StaggerItem>
        )}

        <StaggerItem>
          <Separator className="bg-slate-200 dark:bg-slate-800" />
        </StaggerItem>

        {/* Enlace al hub de conciliación — la actividad detallada vive en el panel "Requiere Atención" del resumen */}
        <StaggerItem>
          <Link
            href="/busy/contabilidad/reconciliacion"
            className={cn(
              'group inline-flex items-center gap-2 text-sm font-medium',
              'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300',
              'transition-colors',
            )}
          >
            Ver centro de conciliación
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </StaggerItem>

        {/* Quick Actions Grid */}
        <StaggerItem className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Gestión General
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const styles = accentStyles[action.tone];
              return (
                <Link key={action.href} href={action.href} className="group">
                  <AnimatedCard className="h-full" hoverEffect={false}>
                    <Card className={cn(
                      "h-full overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-800/2",
                      "hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300",
                      "hover:shadow-md dark:hover:shadow-slate-900/20"
                    )}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={cn("p-2.5 rounded-lg shrink-0", styles.icon)}>
                          <action.icon className="h-5 w-5" />
                        </div>
                        <div className="overflow-hidden">
                          <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {action.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {action.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </AnimatedCard>
                </Link>
              );
            })}
          </div>
        </StaggerItem>
      </StaggerContainer>
    </PageTransition>
  );
}
