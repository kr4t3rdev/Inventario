'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { canAccessAccountingItem } from '@/lib/plan-access';
import { useState, useEffect, useCallback } from 'react';
import { LazyMotion, m as motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, BadgeDollarSign, Plus, RefreshCw, ArrowRightLeft } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { TransferenciaBancaria } from '@/app/models/model';
import { getTransferenciasBancariasAction } from '@/features/contabilidad/actions';
import { cn, formatCurrency } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton';

const TransferenciasBancariasTable = dynamic(() =>
  import('@/features/contabilidad/components/transferencias-bancarias-table').then((mod) => ({
    default: mod.TransferenciasBancariasTable,
  })),
  { loading: () => <Skeleton className="w-full h-100" /> }
);

const TransferenciaBancariaForm = dynamic(() =>
  import('@/features/contabilidad/components/transferencia-bancaria-form').then((mod) => ({
    default: mod.TransferenciaBancariaForm,
  })),
  { loading: () => <Skeleton className="w-full h-100" /> }
);

export default function TransferenciasBancariasPage(): React.JSX.Element | null {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true) }, []);
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [transferenciasList, setTransferenciasList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isBlocked =
    !loading &&
    user?.role !== 'admin' &&
    !canAccessAccountingItem(user, 'Transferencias Bancarias');

  useEffect(() => {
    if (isBlocked) {
      router.replace('/busy/contabilidad');
    }
  }, [isBlocked, router]);

  const fetchTransferencias = useCallback(async () => {
    if (isBlocked) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const res = await getTransferenciasBancariasAction({})
    if (res.success) {
      setTransferenciasList(res.data.transferencias ?? [])
    }
    setIsLoading(false)
  }, [isBlocked])

  useEffect(() => {
    fetchTransferencias()
  }, [fetchTransferencias])

  const hiddenOpacity = isClient && !shouldReduceMotion ? 0 : 1;
  const hiddenY = isClient && !shouldReduceMotion ? 20 : 0;

  const fadeIn = {
    hidden: { opacity: hiddenOpacity },
    show: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.5,
        ease: 'easeOut' as const,
      },
    },
  };

  const fadeInUp = {
    hidden: { opacity: hiddenOpacity, y: hiddenY },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.5,
        ease: 'easeOut' as const,
      },
    },
  };

  const stagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1,
      },
    },
  };

  const handleCreateSuccess = (): void => {
    setIsCreateDialogOpen(false);
    fetchTransferencias();
  };

  const transferenciasHoy = transferenciasList.filter((transferencia: TransferenciaBancaria) => {
    const fechaTransferencia = new Date(transferencia.fechaTransferencia);
    const fechaHoy = new Date();
    return fechaTransferencia.toDateString() === fechaHoy.toDateString();
  });

  const transferenciasTotalCup = transferenciasList.reduce((total: number, transferencia: TransferenciaBancaria) => {
    return transferencia.monedaOrigen === 'CUP' ? total + Number(transferencia.montoOrigen) : total;
  }, 0);

  const transferenciasTotalUsd = transferenciasList.reduce((total: number, transferencia: TransferenciaBancaria) => {
    return transferencia.monedaOrigen === 'USD' ? total + Number(transferencia.montoOrigen) : total;
  }, 0);

  const transferenciasPendientes = transferenciasList.filter((transferencia: TransferenciaBancaria) => {
    return !transferencia.comprobanteGenerado;
  });

  const surfaceCardClass = cn(
    'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
    'dark:border-slate-800/60 dark:bg-slate-900/10',
  );

  if (isBlocked) return null;

  return (
        <motion.div 
          className="space-y-8 p-8" 
          variants={fadeIn} 
          initial="hidden" 
          animate="show"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
            <div className="absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute -bottom-24 left-[-10%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>

          <motion.div
            className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            variants={fadeInUp}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Link href="/busy/contabilidad">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Transferencias
                </h2>
              </div>
              <p className="pl-10 text-muted-foreground">
                Gestiona transferencias entre cuentas con trazabilidad y comprobantes.
              </p>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-sm hover:shadow-md transition-all">
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva transferencia
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl backdrop-blur-xl bg-white/90 dark:bg-slate-500/10">
                <DialogHeader>
                  <DialogTitle>Crear nueva transferencia</DialogTitle>
                  <DialogDescription>
                    Complete los datos para registrar una transferencia entre cuentas.
                  </DialogDescription>
                </DialogHeader>
                <TransferenciaBancariaForm
                  onSuccess={handleCreateSuccess}
                  onCancel={
                  () => setIsCreateDialogOpen(false)
                  }
                />
              </DialogContent>
            </Dialog>
          </motion.div>

          <motion.div className="space-y-6" variants={stagger}>
            <motion.div className="flex flex-wrap items-center gap-2" variants={fadeInUp}>
              <Badge variant="outline" className="h-8 px-3">Total: {transferenciasList.length}</Badge>
              <Badge variant="outline" className="h-8 px-3 bg-blue-50 dark:bg-blue-900/5 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                Hoy: {transferenciasHoy.length}
              </Badge>
              <Badge variant="outline" className="h-8 px-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                Sin comprobante: {transferenciasPendientes.length}
              </Badge>
            </motion.div>

            <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-3" variants={stagger}>
              <motion.div variants={fadeInUp}>
                <Card className={cn(surfaceCardClass)}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Monto Total CUP
                    </CardTitle>
                    <BadgeDollarSign className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      <AnimatedNumber value={transferenciasTotalCup} currency="CUP" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Transferencias emitidas en CUP
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className={cn(surfaceCardClass)}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Monto Total USD
                    </CardTitle>
                    <BadgeDollarSign className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      <AnimatedNumber value={transferenciasTotalUsd} currency="USD" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Transferencias emitidas en USD
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className={cn(surfaceCardClass)}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Pendientes
                    </CardTitle>
                    <RefreshCw className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      <AnimatedNumber value={transferenciasPendientes.length} isInteger />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Operaciones sin comprobante
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle>Historial de Transferencias</CardTitle>
                <CardDescription>
                  Registro completo de movimientos entre cuentas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                  <TransferenciasBancariasTable
                    transferencias={transferenciasList}
                    isLoading={isLoading}
                  />
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
  );
}
