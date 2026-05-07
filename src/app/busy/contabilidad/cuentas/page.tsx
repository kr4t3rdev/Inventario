'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, Plus, Wallet, TrendingUp, CreditCard, Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetCuentasBancariasQuery, useUpdateCuentaBancariaMutation } from '@/features/contabilidad/api/contabilidadApi';
const CuentasBancariasTable = dynamic(
  () =>
    import('@/components/contabilidad/cuentas-bancarias-table').then((mod) => ({
      default: mod.CuentasBancariasTable,
    })),
  {
    loading: () => <Skeleton className="w-full h-100" />,
  },
);
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AnimatedNumber } from '@/components/ui/animated-number'
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from '@/components/ui/animations';

import type { CuentaBancaria } from '@/app/models/model';

const formFallback = (
  <div className="flex h-90 w-full items-center justify-center rounded-xl border border-dashed bg-muted/50 text-muted-foreground">
    <div className="space-y-3 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm">Cargando formulario...</p>
    </div>
  </div>
);

const CuentaBancariaForm = dynamic(
  () =>
    import('@/components/contabilidad/cuenta-bancaria-form').then((mod) => ({
      default: mod.CuentaBancariaForm,
    })),
  {
    loading: () => formFallback,
  },
);

/**
 * @description Página de gestión de cuentas bancarias con tabla y diálogos.
 * @returns {JSX.Element} Página de cuentas bancarias.
 */
export default function CuentasBancariasPage(): React.JSX.Element {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<CuentaBancaria | null>(null);
  const { data: cuentasData = { cuentas: [] }, refetch, isLoading } = useGetCuentasBancariasQuery();
  const [updateCuenta] = useUpdateCuentaBancariaMutation();

  const cuentas = cuentasData.cuentas ?? [];
  const totalCuentas = cuentas.length;
  const cuentasActivas = cuentas.filter((cuenta) => cuenta.isActive).length;
  
  /**
   * @description Calcula el saldo total en la moneda principal (CUP)
   * Las cuentas retornadas por el backend ya incluyen 'saldoEnMonedaPrincipal'
   * que ha sido convertido usando las tasas de cambio correspondientes.
   * @returns {number} Saldo total en moneda principal
   */
  const saldoTotal = cuentas.reduce((sum, cuenta: any) => {
    // Usar saldoEnMonedaPrincipal si está disponible (convertido por backend)
    // Si no, usar el saldo original (fallback)
    const saldoEnPrincipal = cuenta.saldoEnMonedaPrincipal ?? Number(cuenta.saldo ?? 0);
    return sum + saldoEnPrincipal;
  }, 0);

  const surfaceCardClass = cn(
    'relative overflow-hidden border-slate-600/10 shadow-sm backdrop-blur-xl',
    'bg-slate-900/10'
    
  );

  const handleCreateSuccess = (): void => {
    setIsCreateDialogOpen(false);
    refetch();
    toast.success('Cuenta creada exitosamente');
  };

  const handleEditSuccess = (): void => {
    setEditingCuenta(null);
    refetch();
    toast.success('Cuenta actualizada exitosamente');
  };

  const handleEdit = (cuenta: CuentaBancaria): void => {
    setEditingCuenta(cuenta);
  };

  const handleToggleStatus = async (cuenta: CuentaBancaria) => {
    try {
      await updateCuenta({
        id: cuenta.cuentaId,
        isActive: !cuenta.isActive,
        nombreBanco: cuenta.nombreBanco, 
        tipoCuenta: cuenta.tipoCuenta,
        moneda: cuenta.moneda
      }).unwrap();
      refetch();
      toast.success(`Cuenta ${cuenta.isActive ? 'desactivada' : 'activada'} exitosamente`);
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Error al actualizar el estado de la cuenta');
    }
  };

  return (
    <SidebarProvider>
      <SidebarInset className="bg-background">
        <PageTransition className="space-y-8 p-8">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
            <div className="absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute -bottom-24 left-[-10%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>

          <StaggerContainer className="space-y-8">
            <StaggerItem className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
                    Cuentas Bancarias
                  </h2>
                </div>
                <p className="pl-10 text-muted-foreground">
                  Administra los bancos, tipos de cuenta y saldos disponibles. Los saldos se muestran en la moneda principal (CUP).
                </p>
              </div>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="shadow-sm hover:shadow-md transition-all">
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva Cuenta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl backdrop-blur-xl bg-slate-900/10">
                  <DialogHeader>
                    <DialogTitle>Crear nueva cuenta bancaria</DialogTitle>
                    <DialogDescription>
                      Ingresa los detalles de la nueva cuenta bancaria.
                    </DialogDescription>
                  </DialogHeader>
                  <CuentaBancariaForm
                    onSuccess={handleCreateSuccess}
                    onCancel={() => setIsCreateDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </StaggerItem>

            <StaggerItem className="grid gap-4 md:grid-cols-3">
              <AnimatedCard>
                <Card className={cn(surfaceCardClass, "border-l-4 border-l-primary")}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
                    <Wallet className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                          <AnimatedNumber value={totalCuentas} isInteger />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Cuentas registradas en el sistema
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </AnimatedCard>

              <AnimatedCard>
                <Card className={cn(surfaceCardClass, "border-l-4 border-l-chart-2")}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cuentas Activas</CardTitle>
                    <CreditCard className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                           <AnimatedNumber value={cuentasActivas} isInteger />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Disponibles para operaciones
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </AnimatedCard>

              <AnimatedCard>
                <Card className={cn(surfaceCardClass, "border-l-4 border-l-accent")}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo Total Estimado</CardTitle>
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-8 w-32" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                          <AnimatedNumber value={saldoTotal} currency="$" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Suma total en moneda principal (CUP)
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </AnimatedCard>
            </StaggerItem>

            <StaggerItem>
              <Card className={surfaceCardClass}>
                <CardHeader>
                  <CardTitle>Listado de Cuentas</CardTitle>
                  <CardDescription>
                    Gestiona y monitorea el estado de tus cuentas bancarias.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CuentasBancariasTable 
                    cuentas={cuentas} 
                    isLoading={isLoading} 
                    onEdit={handleEdit}
                    onToggleStatus={handleToggleStatus}
                  />
                </CardContent>
              </Card>
            </StaggerItem>
          </StaggerContainer>

          <Dialog open={!!editingCuenta} onOpenChange={(open) => !open && setEditingCuenta(null)}>
            <DialogContent className="max-w-2xl backdrop-blur-xl bg-white/90 dark:bg-slate-950/90">
              <DialogHeader>
                <DialogTitle>Editar cuenta bancaria</DialogTitle>
                <DialogDescription>
                  Modifica la información de la cuenta seleccionada.
                </DialogDescription>
              </DialogHeader>
              {editingCuenta && (
                <CuentaBancariaForm
                  cuenta={editingCuenta}
                  onSuccess={handleEditSuccess}
                  onCancel={() => setEditingCuenta(null)}
                />
              )}
            </DialogContent>
          </Dialog>
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  );
}
