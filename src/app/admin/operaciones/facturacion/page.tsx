'use client';

import React, { useEffect, useState } from 'react';
import { getGlobalBillingHealthAction, type TenantBillingHealth } from '@/features/admin/server/operaciones';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BillingHealthPage() {
  const [data, setData] = useState<TenantBillingHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getGlobalBillingHealthAction();
        if (result.success) {
          setData(result.data?.billingHealth || []);
        } else {
          toast.error('Error cargando datos de facturación');
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

  const getBillingStatus = (metrics: TenantBillingHealth['metrics']) => {
    if (metrics.ventasCount === 0) return { color: 'text-muted-foreground', icon: <FileText className="w-4 h-4" />, label: 'Sin actividad' };
    if (metrics.formalizationRate < 20) return { color: 'text-red-500', icon: <AlertCircle className="w-4 h-4" />, label: 'Baja Formalización' };
    if (metrics.formalizationRate < 70) return { color: 'text-yellow-500', icon: <FileText className="w-4 h-4" />, label: 'Formalización Media' };
    return { color: 'text-green-500', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Alta Formalización' };
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
          <CardTitle className="text-2xl font-bold">Matriz de Salud: Facturación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Tenant</TableHead>
                  <TableHead className="text-center">Plan</TableHead>
                  <TableHead className="text-center">Ventas Totales</TableHead>
                  <TableHead className="text-center">Facturas Emitidas</TableHead>
                  <TableHead className="text-center">Tasa de Formalización</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((tenant) => {
                  const status = getBillingStatus(tenant.metrics);
                  return (
                    <TableRow key={tenant.tenantId} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div>{tenant.nombre}</div>
                        <div className="text-xs text-muted-foreground">{tenant.slug || 'Sin slug'}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{tenant.planName}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{tenant.metrics.ventasCount}</TableCell>
                      <TableCell className="text-center">{tenant.metrics.facturasCount}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-muted h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-primary h-full" 
                              style={{ width: `${Math.min(tenant.metrics.formalizationRate, 100)}%` }} 
                            />
                          </div>
                          <span className="text-xs font-mono">{tenant.metrics.formalizationRate}%</span>
                        </div>
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
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No se encontraron datos de facturación.
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
