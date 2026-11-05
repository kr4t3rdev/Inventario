'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { AccountingPageShell } from '@/features/contabilidad/components/accounting-page-shell';
import { ContabilidadBreadcrumb } from '@/features/contabilidad/components/contabilidad-breadcrumb';
import { cn } from '@/lib/utils';

/**
 * @description Loader para precargar la vista de auditoría.
 * @returns {JSX.Element} Skeleton principal de logs.
 */
function LogsPageLoader() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <Skeleton className="h-[580px] w-full rounded-2xl" />
    </div>
  );
}

const AuditLogsTable = dynamic(
  () => import('@/features/contabilidad/components/audit-logs-table').then((mod) => ({ default: mod.AuditLogsTable })),
  {
    loading: () => <LogsPageLoader />,
  }
);

const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);
const statusBadgeClass = cn(
  'border border-emerald-200/80 bg-emerald-50/80 text-emerald-700',
  'dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300',
);

/**
 * @description Página de auditoría para revisar eventos del módulo contable.
 * @returns {JSX.Element} Vista de logs de auditoría.
 */
export default function LogsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isBlocked =
    !loading &&
    user?.role !== 'admin' &&
    user?.planFeatures?.contabilidad !== true;

  useEffect(() => {
    if (isBlocked) {
      router.replace('/busy/contabilidad');
    }
  }, [isBlocked, router]);

  if (isBlocked) return null;

  if (!mounted) {
    return (
          <div className="space-y-8 p-8">
            <LogsPageLoader />
          </div>
    );
  }

  return (
    <AccountingPageShell
      icon={ShieldCheck}
      title="Auditoría del Sistema"
      description="Visualice, filtre y trace operaciones críticas del módulo de contabilidad."
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/busy/contabilidad" aria-label="Volver a Contabilidad">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Badge className={statusBadgeClass}>
            <ShieldAlert className="mr-1 h-3.5 w-3.5" />
            Seguridad activa
          </Badge>
        </>
      }
    >
      <ContabilidadBreadcrumb />
      <div className={surfaceCardClass}>
        <AuditLogsTable />
      </div>
    </AccountingPageShell>
  );
}
