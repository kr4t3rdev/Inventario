'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  confirmSalesAgentPaymentAction,
  getAdminSalesAgentTenantPaymentsAction,
} from '../actions';

interface TenantPaymentRow {
  referralId: string;
  salesAgentUserId: string;
  salesAgentName: string;
  tenantId: string;
  tenantName: string;
  tenantLicenseId: string | null;
  planName: string | null;
  amountUsd: string | null;
  cycleEndsAt: string | null;
  paymentStatus: string;
}

/**
 * @description Administra la confirmación de pagos de tenants referidos sin mezclarla con payouts.
 * @returns {JSX.Element} Tabla de tenants y diálogo de confirmación.
 */
export function SalesAgentTenantPaymentSection(): React.ReactElement {
  const [rows, setRows] = useState<TenantPaymentRow[]>([]);
  const [selected, setSelected] = useState<TenantPaymentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadRows = async () => {
    setLoading(true);
    const result = await getAdminSalesAgentTenantPaymentsAction(undefined);
    if (result.success) setRows(result.data ?? []);
    else toast.error(result.error?.message ?? 'No se pudieron cargar los tenants referidos');
    setLoading(false);
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const confirmPayment = async () => {
    if (!selected?.tenantLicenseId || !selected.cycleEndsAt) return;
    setSubmitting(true);
    const result = await confirmSalesAgentPaymentAction({
      tenantId: selected.tenantId,
      tenantLicenseId: selected.tenantLicenseId,
      amountPaidUsd: selected.amountUsd ? Number(selected.amountUsd) : undefined,
      idempotencyKey: `sales-agent:${selected.tenantLicenseId}:${selected.cycleEndsAt}`,
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error?.message ?? 'No se pudo confirmar el pago del tenant');
      return;
    }
    toast.success(result.data?.duplicate ? 'El ciclo ya estaba confirmado' : 'Pago confirmado');
    setSelected(null);
    await loadRows();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos de tenants referidos</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gestor</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Licencia</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.referralId}>
                  <TableCell>{row.salesAgentName}</TableCell>
                  <TableCell>{row.tenantName}</TableCell>
                  <TableCell>{row.planName ?? 'Sin licencia vigente'}</TableCell>
                  <TableCell>{row.amountUsd ? `USD ${row.amountUsd}` : '—'}</TableCell>
                  <TableCell>{row.paymentStatus}</TableCell>
                  <TableCell>
                    {row.paymentStatus === 'pending' ? (
                      <Button size="sm" onClick={() => setSelected(row)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirmar pago del tenant
                      </Button>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pago del tenant</DialogTitle>
            <DialogDescription>
              Esta acción acreditará la comisión del gestor para el ciclo vigente de{' '}
              {selected?.tenantName}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={confirmPayment} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
