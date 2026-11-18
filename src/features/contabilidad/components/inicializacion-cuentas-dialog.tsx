'use client';

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { initializeBankAccountsAction } from '@/features/contabilidad/actions-cuentas-bancarias';
import { guardarBorradorInicializacionAction, obtenerBorradorActualInicializacionAction } from '@/features/contabilidad/actions-inicializacion-borrador';
import { getTiposPagoAction } from '@/features/contabilidad/actions-tipos-pago';

type Source = '' | 'CAPITAL_SOCIAL' | 'PRESTAMO' | 'ANTICIPO' | 'NO_DOCUMENTADO';
interface AccountDraft {
  nombreCuenta: string;
  nombreBanco: string;
  numeroCuenta: string;
  tipoCuenta: string;
  moneda: string;
  saldoInicial: string;
  origen: Source;
  tercero: string;
  tasaCambio: string;
  tipoPagoId: string;
}

const newAccount = (): AccountDraft => ({
  nombreCuenta: '', nombreBanco: '', numeroCuenta: '', tipoCuenta: 'CORRIENTE',
  moneda: 'CUP', saldoInicial: '0', origen: '', tercero: '', tasaCambio: '', tipoPagoId: '',
});

const ORIGEN_LABEL: Record<Exclude<Source, ''>, string> = {
  CAPITAL_SOCIAL: 'Inyección de capital',
  PRESTAMO: 'Préstamo',
  ANTICIPO: 'Anticipo de cliente',
  NO_DOCUMENTADO: 'No documentada',
};

/**
 * @description Reconstruye una fila del formulario desde una cuenta parcial de borrador.
 * @param raw - Cuenta del borrador (campos opcionales).
 * @param tasas - Tasas declaradas del borrador, por moneda.
 * @param monedaFuncional - Moneda funcional del borrador.
 * @returns Fila del formulario con valores por defecto para lo ausente.
 */
function toAccountDraft(raw: Record<string, unknown>, tasas: Record<string, string>, monedaFuncional: string): AccountDraft {
  const origenRaw = (raw.origen ?? null) as { tipo?: string; tercero?: string; tasaCambio?: string; tipoPagoId?: string } | null;
  const origen: Source = raw.origenNoDocumentado === true
    ? 'NO_DOCUMENTADO'
    : (origenRaw?.tipo as Source | undefined) ?? '';
  const moneda = typeof raw.moneda === 'string' ? raw.moneda : 'CUP';
  const tasaCambio = typeof origenRaw?.tasaCambio === 'string' && origenRaw.tasaCambio
    ? origenRaw.tasaCambio
    : (moneda !== monedaFuncional ? (tasas[moneda] ?? '') : '');
  return {
    nombreCuenta: typeof raw.nombreCuenta === 'string' ? raw.nombreCuenta : '',
    nombreBanco: typeof raw.nombreBanco === 'string' ? raw.nombreBanco : '',
    numeroCuenta: typeof raw.numeroCuenta === 'string' ? raw.numeroCuenta : '',
    tipoCuenta: typeof raw.tipoCuenta === 'string' ? raw.tipoCuenta : 'CORRIENTE',
    moneda,
    saldoInicial: typeof raw.saldoInicial === 'string' ? raw.saldoInicial : '0',
    origen,
    tercero: typeof origenRaw?.tercero === 'string' ? origenRaw.tercero : '',
    tasaCambio,
    tipoPagoId: typeof origenRaw?.tipoPagoId === 'string' ? origenRaw.tipoPagoId : '',
  };
}

/**
 * @description Lista lo que falta para poder confirmar la inicialización.
 * @param accounts - Cuentas del formulario.
 * @param fechaCorte - Fecha de corte del formulario.
 * @param monedaFuncional - Moneda funcional del formulario.
 * @returns Faltantes en texto, vacía si no hay nada que impida confirmar.
 */
function computeFaltantes(accounts: AccountDraft[], fechaCorte: string, monedaFuncional: string): string[] {
  const faltantes: string[] = [];
  if (fechaCorte.trim() === '') faltantes.push('Falta la fecha de corte');
  if (monedaFuncional.trim() === '') faltantes.push('Falta la moneda funcional');
  accounts.forEach((account, index) => {
    const label = `Cuenta ${index + 1}`;
    if (account.nombreCuenta.trim() === '') faltantes.push(`${label}: falta el nombre de la cuenta`);
    if (account.nombreBanco.trim() === '') faltantes.push(`${label}: falta el banco`);
    if (account.numeroCuenta.trim() === '') faltantes.push(`${label}: falta el número de cuenta`);
    const saldo = Number(account.saldoInicial);
    if (account.saldoInicial.trim() === '' || Number.isNaN(saldo)) {
      faltantes.push(`${label}: falta el saldo inicial`);
      return;
    }
    if (saldo <= 0) return;
    if (account.origen === '') faltantes.push(`${label}: falta la procedencia del saldo`);
    if (account.origen !== '' && account.origen !== 'NO_DOCUMENTADO' && account.tercero.trim() === '') {
      faltantes.push(`${label}: falta el tercero`);
    }
    if (account.origen === 'ANTICIPO' && !account.tipoPagoId) {
      faltantes.push(`${label}: falta el tipo de pago`);
    }
    if (account.moneda !== monedaFuncional && account.tasaCambio.trim() === '') {
      faltantes.push(`${label}: falta la tasa a moneda funcional (${account.moneda} → ${monedaFuncional})`);
    }
  });
  return faltantes;
}

/**
 * @description Suma los saldos por moneda y el total en moneda funcional con las tasas declaradas.
 * @param accounts - Cuentas del formulario.
 * @param monedaFuncional - Moneda funcional del formulario.
 * @returns Subtotales por moneda y total funcional (null si falta una tasa).
 */
function computeTotals(accounts: AccountDraft[], monedaFuncional: string): { porMoneda: Array<{ moneda: string; total: number }>; funcional: number | null } {
  const porMoneda = new Map<string, number>();
  let funcional = 0;
  let sinValorar = false;
  accounts.forEach((account) => {
    const saldo = Number(account.saldoInicial);
    if (Number.isNaN(saldo)) return;
    porMoneda.set(account.moneda, (porMoneda.get(account.moneda) ?? 0) + saldo);
    if (account.moneda === monedaFuncional) {
      funcional += saldo;
      return;
    }
    const tasa = Number(account.tasaCambio);
    if (account.tasaCambio.trim() === '' || Number.isNaN(tasa)) {
      sinValorar = true;
      return;
    }
    funcional += saldo * tasa;
  });
  return { porMoneda: [...porMoneda.entries()].map(([moneda, total]) => ({ moneda, total })), funcional: sinValorar ? null : funcional };
}

/**
 * @description Formulario para capturar cuentas bancarias y saldos de apertura.
 * Guarda el borrador, lo retoma al abrir y revisa las diferencias antes de confirmar.
 * @param props - No recibe propiedades; obtiene los tipos de pago del tenant autenticado.
 * @returns Formulario para enviar una solicitud de inicialización coordinada.
 */
export function InicializacionCuentasDialog(): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [accounts, setAccounts] = useState<AccountDraft[]>([newAccount()]);
  const [paymentTypes, setPaymentTypes] = useState<Array<{ tipoId: string; nombre: string }>>([]);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [fechaCorte, setFechaCorte] = useState(() => new Date().toISOString().slice(0, 10));
  const [monedaFuncional, setMonedaFuncional] = useState('CUP');
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    void getTiposPagoAction({}).then((result) => {
      if (result.success) setPaymentTypes(result.data?.data ?? []);
    });
    void obtenerBorradorActualInicializacionAction().then((result) => {
      if (!result.success || !result.data) return;
      const draft = result.data.borrador as unknown as Record<string, unknown>;
      const tasas = (draft.tasas as Record<string, string> | undefined) ?? {};
      const funcional = typeof draft.monedaFuncional === 'string' ? draft.monedaFuncional : 'CUP';
      const cuentasRaw = Array.isArray(draft.cuentas) ? draft.cuentas : [];
      setMonedaFuncional(funcional);
      if (typeof draft.fechaCorte === 'string' && draft.fechaCorte.trim()) setFechaCorte(draft.fechaCorte);
      if (cuentasRaw.length > 0) {
        setAccounts(cuentasRaw.map((raw) => toAccountDraft(raw as Record<string, unknown>, tasas, funcional)));
      }
      setKey(result.data.idempotencyKey);
      setResumed(true);
    });
  }, [open]);

  const update = (index: number, patch: Partial<AccountDraft>) => {
    setAccounts((current) => current.map((account, i) => i === index ? { ...account, ...patch } : account));
  };

  const buildPayload = () => {
    const tasas: Record<string, string> = {};
    accounts.forEach((account) => {
      if (account.moneda !== monedaFuncional && account.tasaCambio.trim()) {
        tasas[account.moneda] = account.tasaCambio.trim();
      }
    });
    return {
      fechaCorte,
      monedaFuncional,
      ...(Object.keys(tasas).length > 0 ? { tasas } : {}),
      cuentas: accounts.map((account) => {
        const saldoPositivo = Number(account.saldoInicial) > 0;
        const fuente = !saldoPositivo ? {} : account.origen === 'NO_DOCUMENTADO'
          ? { origenNoDocumentado: true }
          : {
            origen: {
              tipo: account.origen as Exclude<Source, '' | 'NO_DOCUMENTADO'>,
              tercero: account.tercero,
              ...(account.tasaCambio ? { tasaCambio: account.tasaCambio } : {}),
              ...(account.origen === 'ANTICIPO' ? { tipoPagoId: account.tipoPagoId } : {}),
            },
          };
        return {
          nombreCuenta: account.nombreCuenta,
          nombreBanco: account.nombreBanco,
          numeroCuenta: account.numeroCuenta,
          tipoCuenta: account.tipoCuenta,
          moneda: account.moneda,
          saldoInicial: account.saldoInicial,
          ...fuente,
        };
      }),
    };
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const result = await guardarBorradorInicializacionAction({ idempotencyKey: key, borrador: buildPayload() });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo guardar el borrador');
      toast.success('Borrador guardado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el borrador');
    } finally {
      setSavingDraft(false);
    }
  };

  const faltantes = computeFaltantes(accounts, fechaCorte, monedaFuncional);
  const totals = computeTotals(accounts, monedaFuncional);

  const submit = async () => {
    setSaving(true);
    try {
      const result = await initializeBankAccountsAction({ idempotencyKey: key, ...buildPayload() });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo inicializar la contabilidad');
      toast.success(result.data?.replayed ? 'Se recuperó la inicialización ya registrada' : 'Cuentas inicializadas');
      setAccounts([newAccount()]);
      setKey(crypto.randomUUID());
      setStep('form');
      setResumed(false);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo inicializar la contabilidad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
<DialogTrigger asChild><Button variant="outline" className="min-h-11">Cargar saldos iniciales</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar cuentas bancarias</DialogTitle>
          <DialogDescription>Agrega las cuentas y sus saldos iniciales.</DialogDescription>
        </DialogHeader>
        {step === 'form' ? (
          <div className="space-y-5">
            {resumed && <p>Borrador retomado: continúa donde lo dejaste. Puedes guardarlo de nuevo o revisarlo para confirmar.</p>}
            {accounts.map((account, index) => (
              <section key={index} className="space-y-3 rounded-md border p-4" aria-label={`Cuenta ${index + 1}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Cuenta {index + 1}</h3>
                  {accounts.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar cuenta ${index + 1}`} onClick={() => setAccounts((rows) => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre de la cuenta"><Input value={account.nombreCuenta} onChange={(e) => update(index, { nombreCuenta: e.target.value })} /></Field>
                  <Field label="Banco"><Input value={account.nombreBanco} onChange={(e) => update(index, { nombreBanco: e.target.value })} /></Field>
                  <Field label="Número de cuenta"><Input value={account.numeroCuenta} onChange={(e) => update(index, { numeroCuenta: e.target.value })} /></Field>
                  <Field label="Tipo"><Select value={account.tipoCuenta} onValueChange={(tipoCuenta) => update(index, { tipoCuenta })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CORRIENTE">Corriente</SelectItem><SelectItem value="AHORROS">Ahorros</SelectItem><SelectItem value="EFECTIVO">Efectivo</SelectItem></SelectContent></Select></Field>
                  <Field label="Moneda"><Select value={account.moneda} onValueChange={(moneda) => update(index, { moneda })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CUP">CUP</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="MLC">MLC</SelectItem></SelectContent></Select></Field>
                  <Field label="Saldo inicial"><Input type="text" inputMode="decimal" value={account.saldoInicial} onChange={(e) => update(index, { saldoInicial: e.target.value, ...(Number(e.target.value) <= 0 ? { origen: '', tercero: '', tasaCambio: '', tipoPagoId: '' } : {}) })} /></Field>
                </div>
                {Number(account.saldoInicial) > 0 && <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Procedencia del saldo"><Select value={account.origen} onValueChange={(origen: Source) => update(index, { origen, tipoPagoId: '' })}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent><SelectItem value="CAPITAL_SOCIAL">Inyección de capital</SelectItem><SelectItem value="PRESTAMO">Préstamo</SelectItem><SelectItem value="ANTICIPO">Anticipo de cliente</SelectItem><SelectItem value="NO_DOCUMENTADO">No documentada</SelectItem></SelectContent></Select></Field>
                  {account.origen === 'NO_DOCUMENTADO' && <p role="note" className="text-sm text-muted-foreground">La procedencia no está documentada. No se clasifica como capital, préstamo o anticipo; su confirmación requiere conciliar la apertura contable.</p>}
                  {account.origen && account.origen !== 'NO_DOCUMENTADO' && <Field label={account.origen === 'PRESTAMO' ? 'Prestamista' : account.origen === 'ANTICIPO' ? 'Cliente' : 'Socio'}><Input value={account.tercero} onChange={(e) => update(index, { tercero: e.target.value })} /></Field>}
                  {account.origen === 'ANTICIPO' && (
                    <Field label="Tipo de pago">
                      <Select value={account.tipoPagoId} onValueChange={(tipoPagoId) => update(index, { tipoPagoId })}>
                        <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                        <SelectContent>{paymentTypes.map((item) => (
                          <SelectItem key={item.tipoId} value={item.tipoId}>{item.nombre}</SelectItem>
                        ))}</SelectContent>
                      </Select>
                    </Field>
                  )}
                  {account.moneda !== monedaFuncional && <Field label="Tasa a moneda funcional (si aplica)"><Input inputMode="decimal" value={account.tasaCambio} onChange={(e) => update(index, { tasaCambio: e.target.value })} /></Field>}
                </div>}
              </section>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de corte"><Input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} /></Field>
              <Field label="Moneda funcional"><Select value={monedaFuncional} onValueChange={setMonedaFuncional}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CUP">CUP</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="MLC">MLC</SelectItem></SelectContent></Select></Field>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setAccounts((rows) => [...rows, newAccount()])} disabled={accounts.length >= 100}><Plus className="mr-2 h-4 w-4" />Agregar cuenta</Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={saveDraft} disabled={savingDraft}>{savingDraft ? 'Guardando…' : 'Guardar borrador'}</Button>
                <Button type="button" className="min-h-11" onClick={() => setStep('review')}>Revisar y confirmar</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <section aria-label="Resumen de la inicialización" className="space-y-3">
              <h3 className="font-medium">Revisar inicialización</h3>
              <p>{`Fecha de corte: ${fechaCorte}`}</p>
              <p>{`Moneda funcional: ${monedaFuncional}`}</p>
              <ul className="space-y-2">
                {accounts.map((account, index) => (
                  <li key={index}>{`${account.nombreCuenta || 'Sin nombre'} — ${account.nombreBanco || 'Sin banco'} · ${account.numeroCuenta || 'Sin número'} · ${account.saldoInicial} ${account.moneda} · ${account.origen ? ORIGEN_LABEL[account.origen] : 'Sin procedencia'}`}</li>
                ))}
              </ul>
              <ul className="space-y-1">
                {totals.porMoneda.map(({ moneda, total }) => (
                  <li key={moneda}>{`Subtotal ${moneda}: ${total}`}</li>
                ))}
              </ul>
              <p>{totals.funcional === null ? 'Total funcional: sin valorar (falta una tasa)' : `Total funcional: ${totals.funcional} ${monedaFuncional}`}</p>
              <p className="text-sm text-muted-foreground">El resumen se calcula con las tasas declaradas; el servidor valida la conciliación al confirmar.</p>
            </section>
            {faltantes.length > 0 && (
              <div role="alert" className="space-y-2 rounded-md border p-4">
                <h4 className="font-medium">Faltantes por resolver</h4>
                <ul className="list-disc space-y-1 pl-5">
                  {faltantes.map((faltante) => (<li key={faltante}>{faltante}</li>))}
                </ul>
                <p className="text-sm text-muted-foreground">No se puede confirmar hasta resolverlos; el borrador se conserva.</p>
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setStep('form')}>Volver al formulario</Button>
              <Button type="button" className="min-h-11" onClick={submit} disabled={saving || faltantes.length > 0}>{saving ? 'Guardando…' : 'Inicializar cuentas'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * @description Agrupa una etiqueta y su control para el formulario.
 * @param props - Texto de etiqueta y control asociado visualmente.
 * @returns Fila accesible del formulario.
 */
function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
