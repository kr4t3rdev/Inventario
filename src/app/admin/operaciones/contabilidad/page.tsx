'use client';

import React, { useEffect, useState } from 'react';
import { getGlobalAccountingHealthAction, type TenantAccountingHealth } from '@/features/admin/server/operaciones';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountingHealthPage() {
  const [data, setData] = useState<TenantAccountingHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getGlobalAccountingHealthAction();
        if (result.success) {
          setData(result.data?.accountingHealth || []);
        } else {
          toast.error('Error cargando datos contables');
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

  const getAccountingStatus = (metrics: TenantAccountingHealth['metrics']) => {
    if (!metrics.hasActivePeriod) return { color: 'text-red-500', icon: <AlertCircle className="w-4 h-4" />, label: 'Bloqueado' };
    if (metrics.totalPeriods < 2) return { color: 'text-yellow-500', icon: <Clock className="w-4 h-4" />, label: 'Iniciando' };
    return { color: 'text-green-500', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Operativo' };
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
          <CardTitle className="text-2xl font-bold">Matriz de Salud: Contabilidad (Periodos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Tenant</TableHead>
                  <TableHead className="text-center">Plan</TableHead>
                  <TableHead className="text-center">Periodo Activo</TableHead>
                  <TableHead className="text-center">Últ. Cierre</TableHead>
                  <TableHead className="text-center">Total Periodos</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((tenant) => {
                  const status = getAccountingStatus(tenant.metrics);
                  return (
                    <TableRow key={tenant.tenantId} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div>{tenant.nombre}</div>
                        <div className="text-xs text-muted-foreground">{tenant.slug || 'Sin slug'}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{tenant.planName}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {tenant.metrics.hasActivePeriod ? (
                          <Badge className="bg-green-500">{tenant.metrics.currentPeriodStatus}</Badge>
                        ) : (
                          <Badge variant="destructive">Ninguno</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {tenant.metrics.lastClosedPeriod || 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">{tenant.metrics.totalPeriods}</TableCell>
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
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No se encontraron datos contables.
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
