'use client';

import React, { useEffect, useState } from 'react';
import { getGlobalPurchaseHealthAction, type TenantPurchaseHealth } from '@/features/admin/server/operaciones';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShoppingCart, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PurchaseHealthPage() {
  const [data, setData] = useState<TenantPurchaseHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getGlobalPurchaseHealthAction();
        if (result.success) {
          setData(result.data?.purchaseHealth || []);
        } else {
          toast.error('Error cargando datos de compras');
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

  const getPurchaseStatus = (metrics: TenantPurchaseHealth['metrics']) => {
    if (metrics.comprasCount === 0) return { color: 'text-red-500', icon: <AlertCircle className="w-4 h-4" />, label: 'Sin Compras' };
    if (metrics.comprasCount < 10) return { color: 'text-yellow-500', icon: <ShoppingCart className="w-4 h-4" />, label: 'Bajo Flujo' };
    return { color: 'text-green-500', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Activo' };
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
          <CardTitle className="text-2xl font-bold">Matriz de Salud: Compra de Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Tenant</TableHead>
                  <TableHead className="text-center">Plan</TableHead>
                  <TableHead className="text-center">Docs Compra</TableHead>
                  <TableHead className="text-right">Total Invertido</TableHead>
                  <TableHead className="text-center">Items Comprados</TableHead>
                  <TableHead className="text-center">Proveedores</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((tenant) => {
                  const status = getPurchaseStatus(tenant.metrics);
                  return (
                    <TableRow key={tenant.tenantId} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div>{tenant.nombre}</div>
                        <div className="text-xs text-muted-foreground">{tenant.slug || 'Sin slug'}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{tenant.planName}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{tenant.metrics.comprasCount}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${tenant.metrics.comprasTotal.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">{tenant.metrics.itemsCount}</TableCell>
                      <TableCell className="text-center">{tenant.metrics.vendorActiveCount}</TableCell>
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
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No se encontraron datos de compras.
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
