'use client';

import { useEffect, useState } from 'react';
import { Gift, Link2, Loader2, TicketPercent } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { SettingsPageShell } from '@/features/configuracion/components/settings-page-shell';
import {
  generateReferralCodeAction,
  getAffiliateDashboardAction,
  getReferralPerkCatalogAction,
  requestCustomReferralPerkAction,
  type AffiliateSummary,
  type ReferralPerkCatalogItem,
} from '@/features/affiliate';

/**
 * @description Dashboard tenant para el programa de referidos.
 * @returns {JSX.Element} Vista de referidos del tenant.
 */
export function AffiliateDashboardPage() {
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [catalog, setCatalog] = useState<ReferralPerkCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const [codeResult, summaryResult, catalogResult] = await Promise.all([
      generateReferralCodeAction(undefined),
      getAffiliateDashboardAction(undefined),
      getReferralPerkCatalogAction(undefined),
    ]);

    if (!codeResult.success) {
      toast.error(codeResult.error?.message ?? 'No se pudo inicializar el programa');
    }
    if (summaryResult.success) {
      setSummary(summaryResult.data ?? null);
    } else {
      toast.error(summaryResult.error?.message ?? 'No se pudo cargar el dashboard');
    }
    if (catalogResult.success) {
      setCatalog(catalogResult.data ?? []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary.referralLink);
    toast.success('Enlace copiado');
  };

  const handleRequestPerk = async () => {
    setIsSubmitting(true);
    const result = await requestCustomReferralPerkAction({
      title: requestTitle,
      description: requestDescription,
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error?.message ?? 'No se pudo enviar la solicitud');
      return;
    }

    toast.success('Solicitud enviada');
    setRequestTitle('');
    setRequestDescription('');
    await loadData();
  };

  const currentTierLabel = summary?.currentTier.replace('tier-', 'Nivel ');

  if (isLoading) {
    return (
      <SettingsPageShell
        icon={Gift}
        title="Referidos"
        description="Obtén crédito para tu próxima licencia y beneficios exclusivos del programa."
      >
        <section role="status" aria-label="Cargando programa de referidos" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-xl border bg-card p-5">
                <Skeleton className="mb-4 h-4 w-28" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="mt-4 h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </section>
      </SettingsPageShell>
    );
  }

  if (!summary) {
    return (
      <SettingsPageShell
        icon={Gift}
        title="Referidos"
        description="Obtén crédito para tu próxima licencia y beneficios exclusivos del programa."
      >
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          No se pudo cargar el programa de referidos.
        </p>
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      icon={Gift}
      title="Referidos"
      description="Obtén crédito para tu próxima licencia y beneficios exclusivos del programa."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Código</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border px-3 py-2 font-mono text-sm">{summary.referralCode}</div>
            <Button variant="outline" onClick={handleCopy} className="w-full">
              <Link2 className="mr-2 h-4 w-4" /> Copiar enlace
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Ventas válidas</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.confirmedSalesCount}</div>
            <p className="text-xs text-muted-foreground">Nivel actual: {currentTierLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Comisión actual</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.round(summary.currentRate * 100)}%</div>
            <p className="text-xs text-muted-foreground">Crédito acumulado: USD {summary.creditAvailableUsd.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Beneficios</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.pendingPerkSlots}</div>
            <p className="text-xs text-muted-foreground">
              Pendientes {summary.pendingPerkSlots} / Asignados {summary.assignedPerksCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {summary.nextLicensePreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TicketPercent className="h-4 w-4" /> Próxima licencia estimada
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4 text-sm">
            <div><p className="text-muted-foreground">Precio base</p><p className="font-semibold">USD {summary.nextLicensePreview.listPriceUsd.toFixed(2)}</p></div>
            <div><p className="text-muted-foreground">Crédito</p><p className="font-semibold">USD {summary.nextLicensePreview.creditAppliedUsd.toFixed(2)}</p></div>
            <div><p className="text-muted-foreground">Total final</p><p className="font-semibold">USD {summary.nextLicensePreview.finalPriceUsd.toFixed(2)}</p></div>
            <div><p className="text-muted-foreground">Saldo arrastrado</p><p className="font-semibold">USD {summary.nextLicensePreview.carryOverCreditUsd.toFixed(2)}</p></div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Referidos</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Confirmado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.referredTenants.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin referidos todavía</TableCell></TableRow>
                ) : summary.referredTenants.map((referral) => (
                  <TableRow key={referral.referralId}>
                    <TableCell>{referral.tenantName}</TableCell>
                    <TableCell>{referral.status}</TableCell>
                    <TableCell>{referral.confirmedAt ? new Date(referral.confirmedAt).toLocaleDateString() : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Catálogo y solicitud personalizada</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {catalog.map((item) => (
                <div key={item.key} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium"><Gift className="h-4 w-4" /> {item.label}</div>
                  <p className="mt-1 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral-perk-title">Título de la idea</Label>
              <Input
                id="referral-perk-title"
                value={requestTitle}
                onChange={(event) => setRequestTitle(event.target.value)}
                placeholder="Escribe el título"
              />
              <Label htmlFor="referral-perk-description">Descripción</Label>
              <Textarea
                id="referral-perk-description"
                value={requestDescription}
                onChange={(event) => setRequestDescription(event.target.value)}
                placeholder="Describe el beneficio que quieres proponer"
                className="min-h-28"
              />
              <Button onClick={handleRequestPerk} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar solicitud
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
  </SettingsPageShell>
  );
}
