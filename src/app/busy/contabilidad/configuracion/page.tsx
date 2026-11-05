'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Settings, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AccountingPageShell } from '@/features/contabilidad/components/accounting-page-shell';
import { AccountingPolicyCard } from '@/features/contabilidad/components/accounting-policy-card';

// Dynamic imports with skeleton loaders
const TiposPagoConfigPage = dynamic(
  () => import('@/features/contabilidad/components/tipos-pago-config-page').then((mod) => ({ default: mod.TiposPagoConfigPage })),
  {
    loading: () => (
      <div className="w-full space-y-4 rounded-xl border border-slate-200/60 bg-white/40 p-6 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-950/40">
        <div className="h-8 w-1/3 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-3 pt-4">
          <div className="h-24 w-full animate-pulse rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
        </div>
      </div>
    ),
    ssr: false,
  },
);

/**
 * @description Página de configuración contable y de tipos de pago.
 * @returns {JSX.Element} Vista de configuración.
 */
export default function ConfiguracionPage(): React.JSX.Element {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-background" />;

  return (
    <AccountingPageShell
      icon={Settings}
      title="Configuración Contable"
      description="Administra los tipos de pago, monedas y parámetros generales del sistema contable."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/busy/contabilidad" aria-label="Volver a Contabilidad">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20">
            <span>Sistema Activo</span>
          </div>
        </div>
      }
    >
      <AccountingPolicyCard />
      <TiposPagoConfigPage />
    </AccountingPageShell>
  );
}
