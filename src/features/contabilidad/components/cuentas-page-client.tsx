"use client"

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { LazyMotion, m as motion } from "framer-motion"
import {
  createCuentaBancariaAction,
  updateCuentaBancariaAction,
} from '@/features/contabilidad/actions-cuentas-bancarias';

interface CuentasPageClientProps {
  cuentas: any[]
}

const emptyForm = { nombreBanco: '', numeroCuenta: '', tipoCuenta: 'AHORROS', saldo: 0, moneda: 'CUP' };

/**
 * @description Componente cliente para la página de cuentas bancarias.
 * Recibe datos desde el Server Component y maneja CRUD via Server Actions.
 */
export function CuentasPageClient({ cuentas: initialCuentas }: CuentasPageClientProps) {
  const router = useRouter();
  const [cuentas, setCuentas] = useState<any[]>(initialCuentas);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  useEffect(() => {
    setCuentas(initialCuentas)
  }, [initialCuentas])

  const resetForm = () => setForm(emptyForm);

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const result = await createCuentaBancariaAction(form);
      if (result.success) {
        toast.success('Cuenta creada exitosamente');
        setIsCreateOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error(result.error?.message || 'Error al crear la cuenta');
      }
    } catch (error) {
      toast.error('Error al crear la cuenta');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setIsSaving(true);
    try {
      const result = await updateCuentaBancariaAction({ cuentaId: editing.cuentaId, ...editForm });
      if (result.success) {
        toast.success('Cuenta actualizada exitosamente');
        setEditing(null);
        setEditForm({});
        router.refresh();
      } else {
        toast.error(result.error?.message || 'Error al actualizar');
      }
    } catch (error) {
      toast.error('Error al actualizar la cuenta');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (cuenta: any) => {
    const result = await updateCuentaBancariaAction({
      cuentaId: cuenta.cuentaId,
      isActive: !cuenta.isActive,
      nombreBanco: cuenta.nombreBanco,
      numeroCuenta: cuenta.numeroCuenta,
      tipoCuenta: cuenta.tipoCuenta,
      moneda: cuenta.moneda,
    });
    if (result.success) {
      toast.success(`Cuenta ${cuenta.isActive ? 'desactivada' : 'activada'} exitosamente`);
      router.refresh();
    } else {
      toast.error('Error al actualizar el estado');
    }
  };

  const openEdit = (cuenta: any) => {
    setEditForm({
      nombreBanco: cuenta.nombreBanco,
      numeroCuenta: cuenta.numeroCuenta,
      tipoCuenta: cuenta.tipoCuenta,
      saldo: cuenta.saldo,
      moneda: cuenta.moneda,
      isActive: cuenta.isActive,
    });
    setEditing(cuenta);
  };

  const totalCuentas = cuentas.length;
  const cuentasActivas = cuentas.filter((c) => c.isActive).length;
  const saldoTotal = cuentas.reduce((sum, c) => sum + Number(c.saldo ?? 0), 0);

  const surfaceCardClass = cn(
    'relative overflow-hidden border-slate-600/10 shadow-sm backdrop-blur-xl',
    'bg-slate-900/10'
  );

  return (
    <SidebarProvider>
      <SidebarInset className="bg-background">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-8 p-8">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Link href="/busy/contabilidad">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Cuentas Bancarias
                </h2>
              </div>
              <p className="pl-10 text-muted-foreground">
                Administra los bancos, tipos de cuenta y saldos disponibles.
              </p>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-sm hover:shadow-md transition-all">
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Cuenta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Crear nueva cuenta bancaria</DialogTitle>
                  <DialogDescription>Ingresa los detalles de la nueva cuenta bancaria.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Banco</Label>
                      <Input value={form.nombreBanco} onChange={e => setForm({...form, nombreBanco: e.target.value})} placeholder="Ej: Banco Nacional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Número de cuenta</Label>
                      <Input value={form.numeroCuenta} onChange={e => setForm({...form, numeroCuenta: e.target.value})} placeholder="Ej: 123-456-789" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={form.tipoCuenta} onValueChange={v => setForm({...form, tipoCuenta: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AHORROS">Ahorros</SelectItem>
                          <SelectItem value="CORRIENTE">Corriente</SelectItem>
                          <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Moneda</Label>
                      <Select value={form.moneda} onValueChange={v => setForm({...form, moneda: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CUP">CUP</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="MLC">MLC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Saldo inicial</Label>
                      <Input type="number" value={form.saldo} onChange={e => setForm({...form, saldo: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancelar</Button>
                    <Button onClick={handleCreate} disabled={isSaving || !form.nombreBanco || !form.numeroCuenta}>
                      {isSaving ? 'Creando...' : 'Crear cuenta'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>

          {/* Stats Cards */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid gap-4 md:grid-cols-3">
            <Card className={cn(surfaceCardClass, "border-l-4 border-l-primary")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
                <Wallet className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCuentas}</div>
                <p className="text-xs text-muted-foreground">Cuentas registradas</p>
              </CardContent>
            </Card>
            <Card className={cn(surfaceCardClass, "border-l-4 border-l-chart-2")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cuentas Activas</CardTitle>
                <CreditCard className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cuentasActivas}</div>
                <p className="text-xs text-muted-foreground">Disponibles para operaciones</p>
              </CardContent>
            </Card>
            <Card className={cn(surfaceCardClass, "border-l-4 border-l-accent")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(saldoTotal)}</div>
                <p className="text-xs text-muted-foreground">Suma total en CUP</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle>Listado de Cuentas</CardTitle>
                <CardDescription>Gestiona y monitorea el estado de tus cuentas bancarias.</CardDescription>
              </CardHeader>
              <CardContent>
                {cuentas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No hay cuentas bancarias registradas.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-3 font-medium">Banco</th>
                          <th className="pb-3 font-medium">Cuenta</th>
                          <th className="pb-3 font-medium">Tipo</th>
                          <th className="pb-3 font-medium">Moneda</th>
                          <th className="pb-3 font-medium text-right">Saldo</th>
                          <th className="pb-3 font-medium">Estado</th>
                          <th className="pb-3 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuentas.map((cuenta: any, i: number) => (
                          <motion.tr
                            key={cuenta.cuentaId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{cuenta.nombreBanco}</span>
                              </div>
                            </td>
                            <td className="py-3 font-mono text-xs">{cuenta.numeroCuenta}</td>
                            <td className="py-3">
                              <Badge variant="outline">{cuenta.tipoCuenta}</Badge>
                            </td>
                            <td className="py-3">{cuenta.moneda}</td>
                            <td className="py-3 text-right font-medium">{formatCurrency(Number(cuenta.saldo ?? 0))}</td>
                            <td className="py-3">
                              <Badge variant={cuenta.isActive ? "default" : "secondary"}>
                                {cuenta.isActive ? 'Activa' : 'Inactiva'}
                              </Badge>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEdit(cuenta)}>
                                  Editar
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleToggleStatus(cuenta)}>
                                  {cuenta.isActive ? 'Desactivar' : 'Activar'}
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Edit Dialog */}
        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar cuenta bancaria</DialogTitle>
              <DialogDescription>Modifica la información de la cuenta seleccionada.</DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <Input value={editForm.nombreBanco} onChange={e => setEditForm({...editForm, nombreBanco: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de cuenta</Label>
                    <Input value={editForm.numeroCuenta} onChange={e => setEditForm({...editForm, numeroCuenta: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={editForm.tipoCuenta} onValueChange={v => setEditForm({...editForm, tipoCuenta: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AHORROS">Ahorros</SelectItem>
                        <SelectItem value="CORRIENTE">Corriente</SelectItem>
                        <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Moneda</Label>
                    <Select value={editForm.moneda} onValueChange={v => setEditForm({...editForm, moneda: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUP">CUP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="MLC">MLC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Saldo</Label>
                    <Input type="number" value={editForm.saldo} onChange={e => setEditForm({...editForm, saldo: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  <Button onClick={handleUpdate} disabled={isSaving}>
                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
