'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { shouldHideBasicAccountingItem } from '@/lib/plan-access';
import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AccountingPageShell } from '@/features/contabilidad/components/accounting-page-shell';
import { ReportesShellLoader } from '@/features/reportes-financieros/components/reportes-shell-loader';
import { cn } from '@/lib/utils';

const ReportesPageLoader = () => <ReportesShellLoader kpis={3} />;

const ReportesAnalyticsPage = dynamic(
  () =>
    import('@/features/contabilidad/components/reportes-analytics-page').then((mod) => ({
      default: mod.ReportesAnalyticsPage,
    })),
  {
    loading: () => <ReportesPageLoader />,
  },
);

const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-950/50',
);
const statusBadgeClass = cn(
  'border border-blue-200/80 bg-blue-50/80 text-blue-700',
  'dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300',
);

/**
 * @description Página principal de reportes financieros del módulo de contabilidad.
 * @returns {JSX.Element} Vista de reportes y análisis.
 */
export default function ReportesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isBlocked =
    !loading &&
    user?.role !== 'admin' &&
    (shouldHideBasicAccountingItem(user, 'Reportes Contables') ||
      user?.planFeatures?.contabilidad !== true);

  useEffect(() => {
    if (isBlocked) {
      router.replace('/busy/contabilidad');
    }
  }, [isBlocked, router]);

  if (isBlocked) return null;

  if (!mounted) {
    return (
          <div className="space-y-8 p-8">
            <ReportesPageLoader />
          </div>
    );
  }

  return (
    <AccountingPageShell
      icon={BarChart3}
      title="Reportes Financieros"
      description="Analice indicadores contables y exporte reportes consolidados por período o cuenta."
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/busy/contabilidad" aria-label="Volver a Contabilidad">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Badge className={statusBadgeClass}>Insights activos</Badge>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Badge variant="outline" className="h-9 px-3">
          Resumen financiero consolidado
        </Badge>
        <Badge variant="outline" className="h-9 px-3">
          Historial y trazabilidad de movimientos
        </Badge>
        <Badge variant="outline" className="h-9 px-3">
          Exportación en CSV/PDF
        </Badge>
      </div>
      <div className={surfaceCardClass}>
        <ReportesAnalyticsPage />
      </div>
    </AccountingPageShell>
  );
}
