'use client';

import React, { useEffect, useState } from 'react';
import { getGlobalExpenseHealthAction, type TenantExpenseHealth } from '@/features/admin/server/operaciones';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ExpenseHealthPage() {
  const [data, setData] = useState<TenantExpenseHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getGlobalExpenseHealthAction();
        if (result.success) {
          setData(result.data?.expenseHealth || []);
        } else {
          toast.error('Error cargando datos de gastos');
        }
      } catch (error) {
        console.error(error);
        toast.error('Ocurrió un error inesperado');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const getExpenseStatus = (metrics: TenantExpenseHealth['metrics']) => {
    if (metrics.gastosCount === 0) return { color: 'text-muted-foreground', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Sin Gastos' };
    if (metrics.gastosCount > 100) return { color: 'text-red-500', icon: <AlertCircle className="w-4 h-4" />, label: 'Gasto Elevado' };
    return { color: 'text-yellow-500', icon: <Wallet className="w-4 h-4" />, label: 'Gasto Normal' };
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Matriz de Salud: Gastos Operativos (GastosDE)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Tenant</TableHead>
                  <TableHead className="text-center">Plan</TableHead>
                  <TableHead className="text-center">Cant. Gastos</TableHead>
                  <TableHead className="text-right">Monto Total</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((tenant) => {
                  const status = getExpenseStatus(tenant.metrics);
                  return (
                    <TableRow key={tenant.tenantId} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div>{tenant.nombre}</div>
                        <div className="text-xs text-muted-foreground">{tenant.slug || 'Sin slug'}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{tenant.planName}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{tenant.metrics.gastosCount}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${tenant.metrics.gastosTotal.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={`flex items-center justify-center gap-1 font-semibold ${status.color}`}>
                          {status.icon}
                          <span className="text-xs">{status.label}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No se encontraron datos de gastos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
