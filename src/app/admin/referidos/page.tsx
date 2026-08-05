'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import {
  applyAffiliateCreditsToLicensePreviewAction,
  assignReferralPerkAction,
  confirmReferredTenantPaymentAction,
  getAffiliateAdminLedgerAction,
  getAffiliateAdminSummaryAction,
  type AffiliateAdminSummaryRow,
  type AffiliateLedgerRow,
  type AffiliateReferralRow,
} from '@/features/affiliate';
import { getLicenciasAction } from '@/features/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SalesAgentAdminPayoutSection } from '@/features/sales-agent/components/sales-agent-admin-payout-section';
import { SalesAgentTenantPaymentSection } from '@/features/sales-agent/components/sales-agent-tenant-payment-section';

export default function AdminReferidosPage() {
  const [summary, setSummary] = useState<AffiliateAdminSummaryRow[]>([]);
  const [referrals, setReferrals] = useState<AffiliateReferralRow[]>([]);
  const [ledger, setLedger] = useState<AffiliateLedgerRow[]>([]);
  const [licenseByTenant, setLicenseByTenant] = useState<Record<string, string>>({});
  const [featureByTenant, setFeatureByTenant] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [payoutsRefreshKey, setPayoutsRefreshKey] = useState(0);

  const loadData = async () => {
    setLoading(true);
    const [summaryResult, ledgerResult, licensesResult] = await Promise.all([
      getAffiliateAdminSummaryAction(undefined),
      getAffiliateAdminLedgerAction(undefined),
      getLicenciasAction(undefined),
    ]);

    if (summaryResult.success) setSummary(summaryResult.data ?? []);
    if (ledgerResult.success) {
      setReferrals(ledgerResult.data?.referrals ?? []);
      setLedger(ledgerResult.data?.ledger ?? []);
    }
    if (licensesResult.success) {
      const data = (licensesResult.data as any[]) ?? [];
      setLicenseByTenant(
        Object.fromEntries(data.map((license: any) => [license.tenantId, license.tenantLicenseId])),
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirm = async (referral: AffiliateReferralRow) => {
    const tenantLicenseId = licenseByTenant[referral.referredTenantId];
    if (!tenantLicenseId) {
      toast.error('No se encontró licencia activa para el referido');
      return;
    }

    const result = await confirmReferredTenantPaymentAction({
      referralId: referral.referralId,
      sourceTenantLicenseId: tenantLicenseId,
    });

    if (!result.success) {
      toast.error(result.error?.message ?? 'No se pudo confirmar el pago');
      return;
    }

    toast.success('Pago confirmado y crédito generado');
    await loadData();
  };

  const handlePreview = async (tenantId: string) => {
    const tenantLicenseId = licenseByTenant[tenantId];
    if (!tenantLicenseId) {
      toast.error('No se encontró licencia para previsualizar');
      return;
    }

    const result = await applyAffiliateCreditsToLicensePreviewAction({ tenantLicenseId });
    if (!result.success) {
      toast.error(result.error?.message ?? 'No se pudo calcular el descuento');
      return;
    }

    toast.success(`Total final USD ${result.data?.finalPriceUsd?.toFixed?.(2) ?? result.data?.finalPriceUsd}`);
    await loadData();
  };

  const handleAssignPerk = async (row: AffiliateAdminSummaryRow) => {
    const tenantId = row.tenantId;
    const tenantLicenseId = licenseByTenant[tenantId];
    const featureKey = featureByTenant[tenantId];
    if (!tenantLicenseId || !featureKey || !row.nextPendingPerkGrantId) {
      toast.error('Seleccioná feature y asegurate de que exista un grant pendiente');
      return;
    }

    const result = await assignReferralPerkAction({
      perkGrantId: row.nextPendingPerkGrantId,
      tenantLicenseId,
      featureKey,
    });
    if (!result.success) {
      toast.error(result.error?.message ?? 'No se pudo asignar el perk');
      return;
    }

    toast.success('Perk asignado');
    await loadData();
  };

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Referidos</h1>
          <p className="text-muted-foreground">Conciliación de comisiones, descuentos y perks.</p>
        </div>
        <Button variant="outline" onClick={loadData}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
      </div>

      <SalesAgentAdminPayoutSection refreshKey={payoutsRefreshKey} />
      <SalesAgentTenantPaymentSection
        onConfirmed={() => setPayoutsRefreshKey((key) => key + 1)}
      />

      <Card>
        <CardHeader><CardTitle>Resumen por tenant</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Ventas</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Total final</TableHead>
                <TableHead>Perks pendientes</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Sin tenants afiliados todavía</TableCell></TableRow>
              ) : summary.map((row) => (
                <TableRow key={row.tenantId}>
                  <TableCell>{row.tenantName}</TableCell>
                  <TableCell className="font-mono text-xs">{row.referralCode}</TableCell>
                  <TableCell>{row.confirmedSalesCount}</TableCell>
                  <TableCell>{Math.round(row.currentRate * 100)}%</TableCell>
                  <TableCell>USD {row.availableCreditUsd.toFixed(2)}</TableCell>
                  <TableCell>{row.planName ?? '—'}</TableCell>
                  <TableCell>USD {row.finalPriceUsd.toFixed(2)}</TableCell>
                  <TableCell>{row.pendingPerkSlots}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => handlePreview(row.tenantId)}>Preview</Button>
                      {row.pendingPerkSlots > 0 ? (
                        <>
                          <Input
                            value={featureByTenant[row.tenantId] ?? ''}
                            onChange={(event) => setFeatureByTenant((prev) => ({ ...prev, [row.tenantId]: event.target.value }))}
                            placeholder="referral-priority-support"
                          />
                          <Button size="sm" onClick={() => handleAssignPerk(row)}>Asignar perk</Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Referidos registrados</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referidor</TableHead>
                  <TableHead>Referido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin referidos</TableCell></TableRow>
                ) : referrals.map((referral) => (
                  <TableRow key={referral.referralId}>
                    <TableCell>{referral.referrerTenantName}</TableCell>
                    <TableCell>{referral.referredTenantName}</TableCell>
                    <TableCell>{referral.status}</TableCell>
                    <TableCell>
                      {referral.status === 'registered' ? (
                        <Button size="sm" onClick={() => handleConfirm(referral)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar pago
                        </Button>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ledger</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Referido</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin ledger todavía</TableCell></TableRow>
                ) : ledger.map((entry) => (
                  <TableRow key={entry.ledgerId}>
                    <TableCell>{entry.referrerTenantName}</TableCell>
                    <TableCell>{entry.referredTenantName}</TableCell>
                    <TableCell>USD {entry.commissionAmount.toFixed(2)}</TableCell>
                    <TableCell>{entry.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
