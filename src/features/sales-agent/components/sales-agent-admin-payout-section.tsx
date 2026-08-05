'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getAdminSalesAgentPayoutsAction } from '@/features/sales-agent/actions';
import {
  SalesAgentPayoutDialog,
  type SalesAgentPayoutTarget,
} from './sales-agent-payout-dialog';

type AdminAgentRow = {
  userId: string;
  name: string;
  isActive: boolean;
  salesAgentProfile: { phone: string | null; status: string } | null;
  salesAgentBalance: { availableUsd: number; paidUsd: number } | null;
  salesAgentReferrals: Array<{ salesAgentReferralId: string }>;
  activeReferralCount: number;
  commissionRate: number;
};

/**
 * @description Sección administrativa separada para saldos y payouts de Gestores.
 * @param {object} props - Props del componente.
 * @param {number} [props.refreshKey] - Clave que al incrementarse dispara una recarga de la tabla.
 * @returns {React.JSX.Element} Tabla de Gestores con acceso al diálogo compartido.
 */
export function SalesAgentAdminPayoutSection({
  refreshKey = 0,
}: {
  refreshKey?: number;
}): React.JSX.Element {
  const [rows, setRows] = useState<AdminAgentRow[]>([]);
  const [target, setTarget] = useState<SalesAgentPayoutTarget | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const result = await getAdminSalesAgentPayoutsAction(undefined);
    if (result.success) setRows((result.data ?? []) as AdminAgentRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [refreshKey]);

  return (
    <Card className="border-violet-200 dark:border-violet-900">
      <CardHeader>
        <CardTitle>Gestores de Ventas · Pagos presenciales</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gestor</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Referidos activos</TableHead>
              <TableHead>Disponible</TableHead>
              <TableHead>Pagado</TableHead>
              <TableHead>Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Sin gestores activos todavía
                </TableCell>
              </TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.userId}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.salesAgentProfile?.phone ?? '—'}</TableCell>
                <TableCell>
                  {row.activeReferralCount} · {Number(row.commissionRate) * 100}%
                </TableCell>
                <TableCell>USD {Number(row.salesAgentBalance?.availableUsd ?? 0).toFixed(2)}</TableCell>
                <TableCell>USD {Number(row.salesAgentBalance?.paidUsd ?? 0).toFixed(2)}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    disabled={!row.isActive || Number(row.salesAgentBalance?.availableUsd ?? 0) <= 0}
                    onClick={() => setTarget({
                      userId: row.userId,
                      name: row.name,
                      phone: row.salesAgentProfile?.phone ?? null,
                      availableUsd: Number(row.salesAgentBalance?.availableUsd ?? 0),
                    })}
                  >
                    Confirmar pago
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <SalesAgentPayoutDialog
          open={Boolean(target)}
          agent={target}
          onOpenChange={(open) => { if (!open) setTarget(null); }}
          onConfirmed={load}
        />
      </CardContent>
    </Card>
  );
}
