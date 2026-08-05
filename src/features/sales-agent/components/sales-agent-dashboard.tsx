'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildSalesAgentShareUrl, buildWhatsAppShareUrl } from '../share';

interface DashboardData {
  referralCode: string;
  summary: {
    totalReferrals: number;
    activeReferrals: number;
    pendingReferrals: number;
    tier: string;
    commissionRate: string;
    availableUsd: string;
    paidUsd: string;
    estimatedAvailableCup: string | null;
    informationalRate: { cupPerUsd: string; effectiveAt: Date } | null;
  };
  referrals: Array<{
    salesAgentReferralId: string;
    status: string;
    tenant: {
      commercialName: string;
      plan: string | null;
      licenseStatus: string;
      licenseExpiration: Date | null;
      commissionBaseUsd: string | null;
    };
  }>;
  commissionHistory: Array<{
    salesAgentCommissionLedgerId: string;
    commissionAmountUsd: string;
    status: string;
    createdAt: Date;
  }>;
  paymentHistory: Array<{
    salesAgentPayoutId: string;
    amountUsd: string;
    amountCup: string;
    status: string;
    processedAt: Date | null;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
  }>;
}

/**
 * @description Panel responsive de métricas, sharing e historial del Gestor propietario.
 * @param {{ data: DashboardData; origin: string | null }} props - DTO privado y origen canónico.
 * @returns {React.JSX.Element} Dashboard interactivo accesible.
 */
export function SalesAgentDashboard({
  data,
  origin,
}: {
  data: DashboardData;
  origin: string | null;
}): React.JSX.Element {
  const referralUrl = useMemo(
    () => buildSalesAgentShareUrl(origin, data.referralCode),
    [data.referralCode, origin],
  );
  const [shareText, setShareText] = useState(
    'Conoce Finance MDM y gestiona tu negocio desde un solo lugar.',
  );
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const flashFeedback = (message: string): void => {
    setShareFeedback(message);
    window.setTimeout(() => setShareFeedback(null), 3000);
  };

  useEffect(() => {
    if (!origin) {
      setQrDataUrl('');
      return;
    }
    void QRCode.toDataURL(referralUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [origin, referralUrl]);

  const copy = async (value: string, kind: 'code' | 'link'): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      flashFeedback('No se pudo copiar. Revisa los permisos del portapapeles.');
    }
  };

  const webShare = async (): Promise<void> => {
    if (!navigator.share) {
      await copy(referralUrl, 'link');
      flashFeedback('Enlace copiado al portapapeles.');
      return;
    }
    try {
      await navigator.share({ title: 'Finance MDM', text: shareText, url: referralUrl });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await copy(referralUrl, 'link');
      flashFeedback('Enlace copiado al portapapeles.');
    }
  };

  const metrics = [
    ['Referidos activos', data.summary.activeReferrals],
    ['Referidos totales', data.summary.totalReferrals],
    ['Pendientes', data.summary.pendingReferrals],
    ['Comisión actual', `${Number(data.summary.commissionRate) * 100}%`],
    ['Disponible', `USD ${data.summary.availableUsd}`],
    ['Pagado', `USD ${data.summary.paidUsd}`],
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-primary">Gestor de Ventas</p>
        <h1 className="text-3xl font-bold tracking-tight">Tus referidos y comisiones</h1>
        <p className="mt-2 text-muted-foreground">Nivel actual: {data.summary.tier}</p>
      </header>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2"><CardTitle asChild className="text-sm"><h2>{label}</h2></CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </section>

      {data.summary.estimatedAvailableCup && data.summary.informationalRate && (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          Estimado informativo: CUP {data.summary.estimatedAvailableCup} a{' '}
          {data.summary.informationalRate.cupPerUsd} CUP/USD. El pago final usa la tasa
          confirmada por administración.
        </p>
      )}

      <Card>
        <CardHeader><CardTitle asChild><h2>Comparte tu enlace</h2></CardTitle></CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="referral-code">Código</label>
              <div className="mt-1 flex gap-2">
                <Input id="referral-code" readOnly value={data.referralCode} />
                <Button aria-label="Copiar código" className="size-11" size="icon" onClick={() => void copy(data.referralCode, 'code')}>
                  {copied === 'code' ? <Check /> : <Copy />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="referral-link">Enlace</label>
              <div className="mt-1 flex gap-2">
                <Input id="referral-link" readOnly value={referralUrl} />
                <Button aria-label="Copiar enlace" className="size-11" size="icon" onClick={() => void copy(referralUrl, 'link')}>
                  {copied === 'link' ? <Check /> : <Copy />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="share-text">Mensaje de WhatsApp</label>
              <Textarea
                id="share-text"
                maxLength={500}
                value={shareText}
                onChange={(event) => setShareText(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {origin && (
                <>
                  <Button onClick={() => void webShare()} size="lg"><Share2 /> Compartir</Button>
                  <Button asChild size="lg" variant="outline">
                    <a href={buildWhatsAppShareUrl(shareText, referralUrl)} rel="noreferrer" target="_blank">
                      WhatsApp <ExternalLink />
                    </a>
                  </Button>
                </>
              )}
            </div>
            {shareFeedback && <p className="text-sm text-muted-foreground" role="status">{shareFeedback}</p>}
          </div>
          <div className="text-center">
            {!origin ? (
              <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                Configura la URL pública para habilitar el QR y compartir el enlace.
              </p>
            ) : qrDataUrl ? (
              // Data URL is generated locally from the first-party referral URL.
              <Image
                unoptimized
                alt="Código QR del enlace de referido"
                className="mx-auto rounded-lg border"
                height={240}
                src={qrDataUrl}
                width={240}
              />
            ) : <div aria-label="Generando código QR" className="h-60 animate-pulse rounded-lg bg-muted" role="status" />}
            <p className="mt-2 text-xs text-muted-foreground">Generado localmente, sin tracking externo.</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <History title="Empresas referidas" empty="Todavía no hay empresas referidas">
          {data.referrals.map((referral) => (
            <li className="rounded-lg border p-3" key={referral.salesAgentReferralId}>
              <p className="font-medium">{referral.tenant.commercialName}</p>
              <p className="text-sm text-muted-foreground">
                {referral.tenant.plan ?? 'Sin plan'} · {referral.tenant.licenseStatus}
              </p>
            </li>
          ))}
        </History>
        <History title="Comisiones" empty="Todavía no hay comisiones">
          {data.commissionHistory.map((entry) => (
            <li className="rounded-lg border p-3" key={entry.salesAgentCommissionLedgerId}>
              USD {entry.commissionAmountUsd} · {entry.status}
            </li>
          ))}
        </History>
        <History title="Pagos" empty="Todavía no hay pagos">
          {data.paymentHistory.map((entry) => (
            <li className="rounded-lg border p-3" key={entry.salesAgentPayoutId}>
              USD {entry.amountUsd} / CUP {entry.amountCup} · {entry.status}
            </li>
          ))}
        </History>
      </section>

      <History title="Notificaciones" empty="No tienes notificaciones">
        {data.notifications.map((notification) => (
          <li className="rounded-lg border p-4" key={notification.id}>
            <p className="font-medium">{notification.title}</p>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
          </li>
        ))}
      </History>
    </div>
  );
}

function History({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <Card>
      <CardHeader><CardTitle asChild><h2>{title}</h2></CardTitle></CardHeader>
      <CardContent>
        {hasChildren ? <ul className="space-y-3">{children}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}
