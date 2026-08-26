'use client';

import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { CheckCircle2, Landmark, Loader2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  createTenantAccountingPolicyApprovalAction,
  getAccountingPolicyStateAction,
  setInitialAccountingPolicyAction,
} from '@/features/contabilidad/actions-accounting-policy';
import { getMonedasAction } from '@/features/contabilidad/actions-exchange';

interface PolicyState {
  policy: {
    functionalCurrencyCode: string;
    createdAt: string | Date;
    updatedBy: string;
  } | null;
  evidence: 'NONE' | 'PRESENT' | 'REVIEW_REQUIRED' | null;
  canManage: boolean;
}

interface CurrencyOption {
  codigo: string;
  nombre: string;
  isActive: boolean;
}

/**
 * @description Permite confirmar o aprobar la moneda funcional del tenant activo.
 * @returns {JSX.Element} Tarjeta accesible de configuración contable.
 */
export function AccountingPolicyCard(): JSX.Element {
  const [state, setState] = useState<PolicyState | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [currencyCode, setCurrencyCode] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    setMessage('');

    Promise.all([getAccountingPolicyStateAction(), getMonedasAction()])
      .then(([policy, money]) => {
        if (!active) return;
        if (!policy.success || !policy.data || !money.success || !Array.isArray(money.data)) {
          throw new Error('Accounting policy configuration could not be loaded');
        }
        setState(policy.data as PolicyState);
        setCurrencies((money.data as CurrencyOption[]).filter((currency) => currency.isActive));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setState(null);
        setCurrencies([]);
        setLoadError(true);
        setLoading(false);
        setMessage('No se pudo cargar la configuración contable. Intenta nuevamente.');
      });
    return () => { active = false; };
  }, [loadAttempt]);

  /**
   * @description Confirma la política o registra aprobación según la evidencia.
   * @param {FormEvent<HTMLFormElement>} event - Envío accesible del formulario.
   * @returns {Promise<void>} Actualiza el estado anunciado al usuario.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!confirmed || !currencyCode || reason.trim().length < 10) return;
    setSubmitting(true);
    setMessage('');

    try {
      const result = state?.evidence === 'PRESENT'
        ? await createTenantAccountingPolicyApprovalAction({
            functionalCurrencyCode: currencyCode,
            reason,
          })
        : await setInitialAccountingPolicyAction({
            functionalCurrencyCode: currencyCode,
            reason,
            returnTo: '/busy/contabilidad/balance-resultados#moneda-funcional',
          });

      if (result.success) {
        setMessage(state?.evidence === 'PRESENT'
          ? 'Aprobación registrada. La revisión de plataforma está pendiente.'
          : 'Moneda funcional configurada correctamente.');
      } else {
        setMessage(result.error?.message ?? 'No se pudo guardar la moneda funcional.');
      }
    } catch {
      setMessage('No se pudo guardar la moneda funcional. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="moneda-funcional"
      aria-labelledby="accounting-policy-card-title"
      className="rounded-2xl border border-slate-200 bg-card p-5 shadow-sm dark:border-slate-800 sm:p-7"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/45 dark:text-cyan-300">
          <Landmark className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="accounting-policy-card-title" className="text-xl font-semibold tracking-[-0.02em]">
            Moneda funcional contable
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Define la moneda que se usará para comparar y presentar los importes contables de
            esta empresa. Esta decisión no se deriva de la moneda principal del catálogo.
          </p>
        </div>
      </div>

      {loading ? (
        <p role="status" className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Verificando configuración...
        </p>
      ) : loadError ? (
        <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <p role="alert">{message}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            className="mt-3 min-h-11"
          >
            Intenta nuevamente
          </Button>
        </div>
      ) : state?.policy ? (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl bg-emerald-50 px-4 py-4 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <div>
            <p className="font-mono text-lg font-semibold">{state.policy.functionalCurrencyCode}</p>
            <p className="text-sm opacity-80">Configuración registrada y disponible en auditoría.</p>
          </div>
        </div>
      ) : !state?.canManage ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          Solo un administrador de esta empresa puede confirmar la moneda funcional contable.
        </p>
      ) : state?.evidence === 'REVIEW_REQUIRED' ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          No se pudo verificar la evidencia contable de forma confiable. Contacta al equipo de
          soporte antes de continuar.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-5">
          {state?.evidence === 'PRESENT' && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
              Se requiere validación adicional. Tu aprobación quedará pendiente de revisión de
              plataforma y no cambiará datos contables por sí sola.
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor="functional-currency" className="text-sm font-medium">
              Moneda funcional contable
            </label>
            <select
              id="functional-currency"
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value)}
              required
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecciona una moneda activa</option>
              {currencies.map((currency) => (
                <option key={currency.codigo} value={currency.codigo}>
                  {currency.codigo} — {currency.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="accounting-policy-reason" className="text-sm font-medium">
              Motivo de la decisión
            </label>
            <textarea
              id="accounting-policy-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={500}
              required
              className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-5 w-5"
            />
            Confirmo que esta será la moneda funcional contable de la empresa y comprendo que
            quedará registrada en auditoría.
          </label>
          <Button type="submit" disabled={!confirmed || submitting} className="min-h-11">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {state?.evidence === 'PRESENT'
              ? 'Registrar mi aprobación'
              : 'Guardar moneda funcional'}
          </Button>
        </form>
      )}

      <p role="status" aria-live="polite" className="mt-4 text-sm font-medium">
        {!loadError && message}
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        La autorización se revalida en el servidor para la empresa activa.
      </div>
    </section>
  );
}
