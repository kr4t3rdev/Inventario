'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { AccountingPageShell } from '@/features/contabilidad/components/accounting-page-shell';
import { canAccessAccountingItem } from '@/lib/plan-access';
import { cn } from '@/lib/utils';

/**
 * @description Loader para la página de ajustes bancarios.
 * @returns {JSX.Element} Skeleton de carga para el contenedor principal.
 */
function AjustesPageLoader() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <Skeleton className="h-[640px] w-full rounded-2xl" />
    </div>
  );
}

const AjustesBancariosPage = dynamic(
  () =>
    import('@/features/contabilidad/components/ajustes-bancarios-page').then((mod) => ({
      default: mod.AjustesBancariosPage,
    })),
  {
    loading: () => <AjustesPageLoader />,
  },
);

const statusBadgeClass = cn(
  'border border-amber-200/80 bg-amber-50/80 text-amber-700',
  'dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300',
);
const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

/**
 * @description Página principal para registrar y auditar ajustes bancarios.
 * @returns {JSX.Element} Vista de ajustes manuales de contabilidad.
 */
export default function AjustesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isBlocked =
    user?.role !== 'admin' && !canAccessAccountingItem(user, 'Ajustes Bancarios');

  useEffect(() => {
    if (isBlocked) {
      router.replace('/busy/contabilidad');
    }
  }, [isBlocked, router]);

  if (isBlocked) return null;

  if (!mounted) {
    return (
      <div className="space-y-8 p-8">
        <AjustesPageLoader />
      </div>
    );
  }

  return (
    <AccountingPageShell
      icon={SlidersHorizontal}
      title="Ajustes Bancarios"
      description="Registre correcciones contables y mantenga trazabilidad completa de cada ajuste."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/busy/contabilidad" aria-label="Volver a Contabilidad">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Badge className={statusBadgeClass}>Control manual habilitado</Badge>
        </div>
      }
    >
      <div className={surfaceCardClass}>
        <AjustesBancariosPage />
      </div>
    </AccountingPageShell>
  );
}
