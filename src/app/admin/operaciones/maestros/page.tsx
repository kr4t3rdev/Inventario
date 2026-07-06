'use client';

import React, { useEffect, useState } from 'react';
import { getGlobalMastersHealthAction, getTenantFeatureDataAction, type TenantMastersHealth, type MasterFeature } from '@/features/admin/server/operaciones';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

export default function MastersHealthPage() {
  const [data, setData] = useState<TenantMastersHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantMastersHealth | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<MasterFeature | null>(null);
  const [featureData, setFeatureData] = useState<any[]>([]);
  const [isFeatureLoading, setIsFeatureLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getGlobalMastersHealthAction();
        if (result.success) {
          setData(result.data?.healthData || []);
        } else {
          toast.error('Error cargando datos de salud');
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

  async function handleFeatureClick(tenantId: string, feature: MasterFeature) {
    setIsFeatureLoading(true);
    try {
      const result = await getTenantFeatureDataAction({ tenantId, feature });
      if (result.success) {
        setFeatureData(result.data || []);
        setSelectedFeature(feature);
      }
    } catch (error) {
      toast.error('Error cargando el detalle');
    } finally {
      setIsFeatureLoading(false);
    }
  }

  const getHealthStatus = (counts: TenantMastersHealth['counts']) => {
    if (counts.categorias === 0 || counts.unidades === 0) return { color: 'text-red-500', icon: <AlertCircle className="w-4 h-4" />, label: 'Crítico' };
    if (counts.productos < 10) return { color: 'text-yellow-500', icon: <Info className="w-4 h-4" />, label: 'Bajo' };
    return { color: 'text-green-500', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Saludable' };
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
          <CardTitle className="text-2xl font-bold">Matriz de Salud: Datos Maestros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Tenant</TableHead>
                  <TableHead className="text-center">Plan</TableHead>
                  <TableHead className="text-center">Productos</TableHead>
                  <TableHead className="text-center">Categorías</TableHead>
                  <TableHead className="text-center">Unidades</TableHead>
                  <TableHead className="text-center">Proveedores</TableHead>
                  <TableHead className="text-center">Ptos Venta</TableHead>
                  <TableHead className="text-center">Listas Precio</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((tenant) => {
                  const status = getHealthStatus(tenant.counts);
                  return (
                    <TableRow key={tenant.tenantId} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {tenant.nombre}
                          <Button variant="ghost" size="sm" onClick={() => setSelectedTenant(tenant)} className="h-6 w-6 p-0">
                            <Info className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">{tenant.slug || 'Sin slug'}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{tenant.planName}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="link" className="p-0 h-auto text-foreground font-normal underline" onClick={() => handleFeatureClick(tenant.tenantId, 'productos')}>
                          {tenant.counts.productos}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="link" className="p-0 h-auto text-foreground font-normal underline" onClick={() => handleFeatureClick(tenant.tenantId, 'categorias')}>
                          {tenant.counts.categorias}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="link" className="p-0 h-auto text-foreground font-normal underline" onClick={() => handleFeatureClick(tenant.tenantId, 'unidades')}>
                          {tenant.counts.unidades}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="link" className="p-0 h-auto text-foreground font-normal underline" onClick={() => handleFeatureClick(tenant.tenantId, 'proveedores')}>
                          {tenant.counts.proveedores}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="link" className="p-0 h-auto text-foreground font-normal underline" onClick={() => handleFeatureClick(tenant.tenantId, 'puntosDeVenta')}>
                          {tenant.counts.puntosDeVenta}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="link" className="p-0 h-auto text-foreground font-normal underline" onClick={() => handleFeatureClick(tenant.tenantId, 'listasPrecio')}>
                          {tenant.counts.listasPrecio}
                        </Button>
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
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sheet para el Drill-Down de datos */}
      <Sheet open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Detalle: {selectedTenant?.nombre}</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTenant(null)}>
                <X className="w-4 h-4" />
              </Button>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-muted rounded-lg text-sm">
              <p><strong>Plan:</strong> {selectedTenant?.planName}</p>
              <p><strong>ID:</strong> {selectedTenant?.tenantId}</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-bold text-lg mb-4">Explorador de Datos</h3>
              {isFeatureLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {!selectedFeature && (
                    <p className="text-muted-foreground text-sm text-center py-10">
                      Haz clic en un número de la matriz para explorar los datos de este tenant.
                    </p>
                  )}
                  {selectedFeature && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold capitalize">{selectedFeature.replace(/([A-Z])/g, ' $1')}</span>
                        <Badge variant="secondary">{featureData.length} registros</Badge>
                      </div>
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableBody>
                            {featureData.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs py-2">
                                  {item.nombre || item.nombre || item.logoUrl || 'Sin nombre'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
