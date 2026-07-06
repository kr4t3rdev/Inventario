'use client';

import React, { useEffect, useState } from 'react';
import { getGlobalOffersServicesHealthAction, type TenantOffersServicesHealth } from '@/features/admin/server/operaciones';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OffersServicesHealthPage() {
  const [data, setData] = useState<TenantOffersServicesHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getGlobalOffersServicesHealthAction();
        if (result.success) {
          setData(result.data?.healthData || []);
        } else {
          toast.error('Error cargando datos de ofertas y servicios');
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

  const getHealthStatus = (metrics: TenantOffersServicesHealth['metrics']) => {
    if (metrics.ofertasCount === 0 && metrics.serviciosCount === 0) return { color: 'text-muted-foreground', icon: <AlertCircle className="w-4 h-4" />, label: 'Sin Uso' };
    if (metrics.ofertasCount > 20 || metrics.serviciosCount > 5) return { color: 'text-green-500', icon: <Sparkles className="w-4 h-4" />, label: 'Uso Activo' };
    return { color: 'text-yellow-500', icon: <Sparkles className="w-4 h-4" />, label: 'Uso Leve' };
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
          <CardTitle className="text-2xl font-bold">Matriz de Salud: Ofertas y Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Tenant</TableHead>
                  <TableHead className="text-center">Plan</TableHead>
                  <TableHead className="text-center">Ofertas Emitidas</TableHead>
                  <TableHead className="text-center">Servicios Configurados</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((tenant) => {
                  const status = getHealthStatus(tenant.metrics);
                  return (
                    <TableRow key={tenant.tenantId} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div>{tenant.nombre}</div>
                        <div className="text-xs text-muted-foreground">{tenant.slug || 'Sin slug'}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{tenant.planName}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{tenant.metrics.ofertasCount}</TableCell>
                      <TableCell className="text-center">{tenant.metrics.serviciosCount}</TableCell>
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
                      No se encontraron datos de ofertas o servicios.
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
