'use client';

import { ArrowLeft, Coins } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { AccountingPageShell } from '@/features/contabilidad/components/accounting-page-shell';
import { shouldHideBasicAccountingItem } from '@/lib/plan-access';
import { cn } from '@/lib/utils';

/**
 * @description Indicador de precarga para la página de exchange.
 * @returns {JSX.Element} Skeleton de la vista mientras carga el contenido.
 */
function ExchangePageLoader() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-[520px] w-full rounded-2xl" />
    </div>
  );
}

const ExchangeManager = dynamic(
  () =>
    import('@/features/contabilidad/components/exchange-manager').then((mod) => ({
      default: mod.ExchangeManager,
    })),
  {
    loading: () => <ExchangePageLoader />,
  },
);

const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);
const statusBadgeClass = cn(
  'border border-blue-200/80 bg-blue-50/80 text-blue-700',
  'dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300',
);

/**
 * @description Página para gestión de monedas, tasas de cambio y conversiones.
 * @returns {JSX.Element} Vista principal de exchange.
 */
export default function ExchangePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isBlocked =
    user?.role !== 'admin' &&
    (shouldHideBasicAccountingItem(user, 'Exchange') ||
      user?.planFeatures?.['multi-moneda'] !== true);

  useEffect(() => {
    if (isBlocked) {
      router.replace('/busy/contabilidad');
    }
  }, [isBlocked, router]);

  if (isBlocked) return null;

  if (!mounted) {
    return (
      <div className="space-y-8 p-8">
        <ExchangePageLoader />
      </div>
    );
  }

  return (
    <AccountingPageShell
      icon={Coins}
      title="Exchange y Monedas"
      description="Gestione tasas de cambio, conversiones y monedas operativas con trazabilidad."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/busy/contabilidad" aria-label="Volver a Contabilidad">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Badge className={statusBadgeClass}>Módulo en tiempo real</Badge>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Badge variant="outline" className="h-9 px-3">
          Tasas vigentes centralizadas
        </Badge>
        <Badge variant="outline" className="h-9 px-3">
          Conversión con histórico de cambios
        </Badge>
        <Badge variant="outline" className="h-9 px-3">
          Configuración multi-moneda
        </Badge>
      </div>
      <div className={surfaceCardClass}>
        <ExchangeManager />
      </div>
    </AccountingPageShell>
  );
}
