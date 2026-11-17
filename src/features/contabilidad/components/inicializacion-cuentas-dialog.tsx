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

/**
 * @description Formulario para capturar cuentas bancarias y saldos de apertura.
 * @param props - No recibe propiedades; obtiene los tipos de pago del tenant autenticado.
 * @returns Formulario para enviar una solicitud de inicialización coordinada.
 */
export function InicializacionCuentasDialog(): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountDraft[]>([newAccount()]);
  const [paymentTypes, setPaymentTypes] = useState<Array<{ tipoId: string; nombre: string }>>([]);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [fechaCorte, setFechaCorte] = useState(() => new Date().toISOString().slice(0, 10));
  const [monedaFuncional, setMonedaFuncional] = useState('CUP');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void getTiposPagoAction({}).then((result) => {
      if (result.success) setPaymentTypes(result.data?.data ?? []);
    });
  }, [open]);

  const update = (index: number, patch: Partial<AccountDraft>) => {
    setAccounts((current) => current.map((account, i) => i === index ? { ...account, ...patch } : account));
  };

  const submit = async () => {
    setSaving(true);
    try {
      const tasas: Record<string, string> = {};
      accounts.forEach((account) => {
        if (account.moneda !== monedaFuncional && account.tasaCambio.trim()) {
          tasas[account.moneda] = account.tasaCambio.trim();
        }
      });
      const result = await initializeBankAccountsAction({
        idempotencyKey: key,
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
      });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo inicializar la contabilidad');
      toast.success(result.data?.replayed ? 'Se recuperó la inicialización ya registrada' : 'Cuentas inicializadas');
      setAccounts([newAccount()]);
      setKey(crypto.randomUUID());
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo inicializar la contabilidad');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = fechaCorte.trim() !== '' && monedaFuncional.trim() !== '' && accounts.every((a) => a.nombreCuenta.trim() && a.nombreBanco.trim()
    && a.numeroCuenta.trim() && a.saldoInicial !== ''
    && (Number(a.saldoInicial) <= 0 || a.origen === 'NO_DOCUMENTADO' || (a.origen && a.tercero.trim()
      && (a.origen !== 'ANTICIPO' || a.tipoPagoId)))
    && (Number(a.saldoInicial) <= 0 || a.moneda === monedaFuncional || a.tasaCambio.trim() !== ''));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Inicializar saldos</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar cuentas bancarias</DialogTitle>
          <DialogDescription>Agrega las cuentas y sus saldos iniciales.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
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
            <Button type="button" variant="outline" onClick={() => setAccounts((rows) => [...rows, newAccount()])} disabled={accounts.length >= 100}><Plus className="mr-2 h-4 w-4" />Agregar cuenta</Button>
            <Button type="button" onClick={submit} disabled={saving || !canSubmit}>{saving ? 'Guardando…' : 'Inicializar cuentas'}</Button>
          </div>
        </div>
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
