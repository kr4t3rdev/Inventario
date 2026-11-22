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
import { useAuth } from '@/contexts/auth-context';
import { getProductosAction } from '@/features/productos/actions-crud';
import { getAlmacenesAction } from '@/features/almacenes/actions';
import { getClientesAction } from '@/features/clientes/actions';
import { getVendorsAction } from '@/features/vendors/actions';
import {
  calculateOpeningAccountTotals,
  findOpeningCurrencyRateConflicts,
  findUnpersistableOpeningRateConflicts,
  resolveOpeningCurrencyRates,
} from '@/features/contabilidad/services/initialization-currency-rates';
import {
  InitializationAdditionalSections,
  newInitialInventoryDraft,
  newInitialPayableDraft,
  newInitialReceivableDraft,
  toInitialInventoryDraft,
  toInitialPayableDraft,
  toInitialReceivableDraft,
  type InitialInventoryDraft,
  type InitialPayableDraft,
  type InitialReceivableDraft,
} from './initialization-additional-sections';

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
  proveedorId: string;
  tasaInteres: string;
  tasaInteresMoratorio: string;
  fechaVencimiento: string;
}

const newAccount = (): AccountDraft => ({
  nombreCuenta: '', nombreBanco: '', numeroCuenta: '', tipoCuenta: 'CORRIENTE',
  moneda: 'CUP', saldoInicial: '0', origen: '', tercero: '', tasaCambio: '', tipoPagoId: '',
  proveedorId: '', tasaInteres: '', tasaInteresMoratorio: '', fechaVencimiento: '',
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
  const origenRaw = (raw.origen ?? null) as {
    tipo?: string; tercero?: string; tasaCambio?: string; tipoPagoId?: string;
    proveedorId?: string; tasaInteres?: string; tasaInteresMoratorio?: string; fechaVencimiento?: string;
  } | null;
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
    saldoInicial: typeof raw.saldoInicial === 'string' ? raw.saldoInicial : '',
    origen,
    tercero: typeof origenRaw?.tercero === 'string' ? origenRaw.tercero : '',
    tasaCambio,
    tipoPagoId: typeof origenRaw?.tipoPagoId === 'string' ? origenRaw.tipoPagoId : '',
    proveedorId: typeof origenRaw?.proveedorId === 'string' ? origenRaw.proveedorId : '',
    tasaInteres: typeof origenRaw?.tasaInteres === 'string' ? origenRaw.tasaInteres : '',
    tasaInteresMoratorio: typeof origenRaw?.tasaInteresMoratorio === 'string' ? origenRaw.tasaInteresMoratorio : '',
    fechaVencimiento: typeof origenRaw?.fechaVencimiento === 'string' ? origenRaw.fechaVencimiento : '',
  };
}

/**
 * @description Lista lo que falta para poder confirmar la inicialización.
 * @param accounts - Cuentas del formulario.
 * @param fechaCorte - Fecha de corte del formulario.
 * @param monedaFuncional - Moneda funcional del formulario.
 * @returns Faltantes en texto, vacía si no hay nada que impida confirmar.
 */
function computeFaltantes(
  accounts: AccountDraft[],
  fechaCorte: string,
  monedaFuncional: string,
  tasas: Record<string, string> = {},
): string[] {
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
    if (account.origen === 'PRESTAMO' && account.proveedorId && !account.tasaInteres) {
      faltantes.push(`${label}: falta la tasa de interés ordinaria`);
    }
    if (account.origen === 'PRESTAMO' && account.proveedorId && !account.tasaInteresMoratorio) {
      faltantes.push(`${label}: falta la tasa de interés moratoria`);
    }
    if (account.moneda !== monedaFuncional && account.tasaCambio.trim() === '' && !tasas[account.moneda]) {
      faltantes.push(`${label}: falta la tasa a moneda funcional (${account.moneda} → ${monedaFuncional})`);
    }
  });
  return faltantes;
}

/**
 * @description Formulario para capturar cuentas bancarias y saldos de apertura.
 * Guarda el borrador, lo retoma al abrir y revisa las diferencias antes de confirmar.
 * @param props - No recibe propiedades; obtiene los tipos de pago del tenant autenticado.
 * @returns Formulario para enviar una solicitud de inicialización coordinada.
 */
export function InicializacionCuentasDialog(): ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const hasFeature = (feature: string) => user?.role === 'admin' || user?.planFeatures?.[feature] === true;
  const canInventory = hasFeature('productos');
  const canReceivable = hasFeature('cuentas-cobrar') && hasFeature('clientes');
  const canLoanReceivable = canReceivable && hasFeature('prestamos-cash');
  const canPayable = hasFeature('cuentas-pagar');
  const canDebt = hasFeature('deudas-cash');
  const canCapital = hasFeature('inyeccion-capital');
  const canAdvance = hasFeature('anticipos');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [accounts, setAccounts] = useState<AccountDraft[]>([newAccount()]);
  const [inventory, setInventory] = useState<InitialInventoryDraft[]>([]);
  const [receivables, setReceivables] = useState<InitialReceivableDraft[]>([]);
  const [payables, setPayables] = useState<InitialPayableDraft[]>([]);
  const [initialRates, setInitialRates] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Array<{ id: string; nombre: string }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; nombre: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; nombre: string }>>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; nombre: string }>>([]);
  const [paymentTypes, setPaymentTypes] = useState<Array<{ tipoId: string; nombre: string }>>([]);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [fechaCorte, setFechaCorte] = useState(() => new Date().toISOString().slice(0, 10));
  const [monedaFuncional, setMonedaFuncional] = useState('CUP');
  const currencies = Array.from(new Set(hasFeature('multi-moneda')
    ? ['CUP', 'USD', 'MLC', monedaFuncional]
    : [monedaFuncional]));
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    const loadLookups = async () => {
      const calls: Array<Promise<void>> = [
        getTiposPagoAction({}).then((result) => {
          if (result.success) setPaymentTypes(result.data?.data ?? []);
          else toast.error(result.error?.message || 'No se pudieron cargar los tipos de pago');
        }),
      ];
      if (canInventory) {
        calls.push(getProductosAction().then((result) => {
          if (result.success) setProducts((result.data ?? []).map((item) => ({ id: item.id, nombre: item.nombre })));
          else toast.error(result.error?.message || 'No se pudieron cargar los productos');
        }));
        calls.push(getAlmacenesAction().then((result) => {
          if (result.success) setWarehouses((result.data ?? []).map((item) => ({ id: item.almacenId, nombre: item.nombre })));
          else toast.error(result.error?.message || 'No se pudieron cargar los almacenes');
        }));
      }
      if (canReceivable) calls.push(getClientesAction().then((result) => {
        if (result.success) setClients((result.data ?? []).map((item) => ({ id: item.clienteId, nombre: item.nombre })));
        else toast.error(result.error?.message || 'No se pudieron cargar los clientes');
      }));
      if (canPayable || canDebt) calls.push(getVendorsAction().then((result) => {
        if (result.success) setVendors((result.data ?? []).map((item) => ({ id: item.vendorId, nombre: item.nombre })));
        else toast.error(result.error?.message || 'No se pudieron cargar los proveedores');
      }));
      await Promise.all(calls);
      const draftResult = await obtenerBorradorActualInicializacionAction();
      if (!draftResult.success || !draftResult.data) return;
      const draft = draftResult.data.borrador as unknown as Record<string, unknown>;
      const tasas = (draft.tasas as Record<string, string> | undefined) ?? {};
      const funcional = typeof draft.monedaFuncional === 'string' ? draft.monedaFuncional : 'CUP';
      const cuentasRaw = Array.isArray(draft.cuentas) ? draft.cuentas : [];
      setMonedaFuncional(funcional);
      setInitialRates(Object.fromEntries(Object.entries(tasas).filter((entry): entry is [string, string] =>
        typeof entry[1] === 'string')));
      setFechaCorte(typeof draft.fechaCorte === 'string' && draft.fechaCorte.trim() ? draft.fechaCorte : '');
      if (cuentasRaw.length > 0) {
        setAccounts(cuentasRaw.map((raw) => toAccountDraft(raw as Record<string, unknown>, tasas, funcional)));
      }
      setInventory(Array.isArray(draft.inventario) ? draft.inventario.map(toInitialInventoryDraft) : []);
      setReceivables(Array.isArray(draft.cuentasPorCobrar) ? draft.cuentasPorCobrar.map(toInitialReceivableDraft) : []);
      setPayables(Array.isArray(draft.cuentasPorPagar) ? draft.cuentasPorPagar.map(toInitialPayableDraft) : []);
      setKey(draftResult.data.idempotencyKey);
      setResumed(true);
    };
    void loadLookups().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las opciones de inicialización');
    });
  }, [open, canInventory, canReceivable, canPayable, canDebt]);

  const update = (index: number, patch: Partial<AccountDraft>) => {
    setAccounts((current) => current.map((account, i) => i === index ? { ...account, ...patch } : account));
    if (Object.hasOwn(patch, 'tasaCambio')) {
      const currency = accounts[index]?.moneda;
      if (currency) {
        setInitialRates((current) => {
          const next = { ...current };
          delete next[currency];
          return next;
        });
      }
    }
  };

  const resolveRates = (): Record<string, string> => {
    return resolveOpeningCurrencyRates(accounts, monedaFuncional, initialRates);
  };

  const buildPayload = () => {
    const tasas = resolveRates();
    return {
      ...(fechaCorte.trim() ? { fechaCorte: fechaCorte.trim() } : {}),
      monedaFuncional,
      ...(Object.keys(tasas).length > 0 ? { tasas } : {}),
      ...(inventory.length ? { inventario: inventory.map((row) => ({
        referenciaFila: row.referenciaFila,
        ...(row.productoId ? { productoId: row.productoId } : {}),
        ...(row.almacenId ? { almacenId: row.almacenId } : {}),
        ...(row.ubicacionId ? { ubicacionId: row.ubicacionId } : {}),
        ...(row.loteCodigo ? { loteCodigo: row.loteCodigo } : {}),
        ...(row.cantidad ? { cantidad: row.cantidad } : {}),
        ...(row.costoUnitario ? { costoUnitario: row.costoUnitario } : {}),
        moneda: row.moneda,
        ...(fechaCorte.trim() ? { fechaCorte: fechaCorte.trim() } : row.fechaCorte ? { fechaCorte: row.fechaCorte } : {}),
        ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
        ...(row.tasaCambio ? { tasaCambio: row.tasaCambio } : {}),
      })) } : {}),
      ...(receivables.length ? { cuentasPorCobrar: receivables.map((row) => ({
        referenciaFila: row.referenciaFila,
        ...(row.clienteId ? { clienteId: row.clienteId } : {}),
        ...(row.referenciaExterna ? { referenciaExterna: row.referenciaExterna } : {}),
        moneda: row.moneda,
        ...(row.saldo ? { saldo: row.saldo } : {}),
        ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
        ...(row.tasaCambio ? { tasaCambio: row.tasaCambio } : {}),
        ...(row.tasaInteres ? { tasaInteres: row.tasaInteres } : {}),
        ...(row.tasaInteresMoratorio ? { tasaInteresMoratorio: row.tasaInteresMoratorio } : {}),
      })) } : {}),
      ...(payables.length ? { cuentasPorPagar: payables.map((row) => ({
        referenciaFila: row.referenciaFila,
        ...(row.proveedorId ? { proveedorId: row.proveedorId } : {}),
        ...(row.referenciaExterna ? { referenciaExterna: row.referenciaExterna } : {}),
        moneda: row.moneda,
        ...(row.saldo ? { saldo: row.saldo } : {}),
        ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
        ...(row.tasaCambio ? { tasaCambio: row.tasaCambio } : {}),
      })) } : {}),
      cuentas: accounts.map((account) => {
        const saldoPositivo = Number(account.saldoInicial) > 0;
        // El contrato parcial valida los campos que recibe: un texto vacío
        // ('') no pasa requiredText, así que se omite y el borrador queda
        // incompleto pero guardable. La confirmación sigue exigiendo los
        // faltantes en la revisión.
        const fuente = !saldoPositivo ? {} : account.origen === 'NO_DOCUMENTADO'
          ? { origenNoDocumentado: true }
          : account.origen === '' ? {}
          : {
            origen: {
              tipo: account.origen as Exclude<Source, '' | 'NO_DOCUMENTADO'>,
              ...(account.tercero.trim() ? { tercero: account.tercero.trim() } : {}),
              ...(account.tasaCambio.trim() ? { tasaCambio: account.tasaCambio.trim() } : {}),
              ...(account.origen === 'ANTICIPO' && account.tipoPagoId.trim() ? { tipoPagoId: account.tipoPagoId.trim() } : {}),
              ...(account.origen === 'PRESTAMO' && account.proveedorId ? {
                proveedorId: account.proveedorId,
                ...(account.tasaInteres ? { tasaInteres: account.tasaInteres } : {}),
                ...(account.tasaInteresMoratorio ? { tasaInteresMoratorio: account.tasaInteresMoratorio } : {}),
                ...(account.fechaVencimiento ? { fechaVencimiento: account.fechaVencimiento } : {}),
              } : {}),
            },
          };
        return {
          ...(account.nombreCuenta.trim() ? { nombreCuenta: account.nombreCuenta.trim() } : {}),
          ...(account.nombreBanco.trim() ? { nombreBanco: account.nombreBanco.trim() } : {}),
          ...(account.numeroCuenta.trim() ? { numeroCuenta: account.numeroCuenta.trim() } : {}),
          tipoCuenta: account.tipoCuenta,
          moneda: account.moneda,
          ...(account.saldoInicial.trim() ? { saldoInicial: account.saldoInicial.trim() } : {}),
          ...fuente,
        };
      }),
    };
  };

  const saveDraft = async () => {
    if (unpersistableDraftRateConflicts.length > 0) {
      toast.error(`Unifica las tasas por cuenta para ${unpersistableDraftRateConflicts.join(', ')} antes de guardar el borrador`);
      return;
    }
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

  const tasasEfectivas = resolveRates();
  const unpersistableDraftRateConflicts = findUnpersistableOpeningRateConflicts(
    accounts.map((account) => ({
      moneda: account.moneda,
      saldoInicial: account.saldoInicial,
      tasaCambio: account.tasaCambio,
      origen: account.origen,
    })),
    monedaFuncional,
  );
  const faltantes = [
    ...computeFaltantes(accounts, fechaCorte, monedaFuncional, tasasEfectivas),
    ...findOpeningCurrencyRateConflicts(accounts, monedaFuncional).map((currency) =>
      `Unifica la tasa bancaria para ${currency} antes de confirmar`,
    ),
    ...inventory.flatMap((row, index) => [
      ...(!row.productoId ? [`Inventario ${index + 1}: falta el producto`] : []),
      ...(!row.almacenId ? [`Inventario ${index + 1}: falta el almacén`] : []),
      ...(!row.loteCodigo.trim() ? [`Inventario ${index + 1}: falta el lote`] : []),
      ...(!row.cantidad.trim() ? [`Inventario ${index + 1}: falta la cantidad`] : []),
      ...(!row.costoUnitario.trim() ? [`Inventario ${index + 1}: falta el costo`] : []),
      ...(row.moneda !== monedaFuncional && Number(row.costoUnitario) !== 0 && !row.tasaCambio.trim() && !tasasEfectivas[row.moneda]
        ? [`Inventario ${index + 1}: falta la tasa de ${row.moneda}`] : []),
    ]),
    ...receivables.flatMap((row, index) => [
      ...(!row.clienteId ? [`CxC ${index + 1}: falta el cliente`] : []),
      ...(!row.saldo.trim() ? [`CxC ${index + 1}: falta el saldo`] : []),
      ...(Boolean(row.tasaInteres) !== Boolean(row.tasaInteresMoratorio)
        ? [`CxC ${index + 1}: indica ambas tasas del préstamo`] : []),
      ...(row.moneda !== monedaFuncional && !row.tasaCambio.trim() && !tasasEfectivas[row.moneda]
        ? [`CxC ${index + 1}: falta la tasa de ${row.moneda}`] : []),
    ]),
    ...payables.flatMap((row, index) => [
      ...(!row.proveedorId ? [`CxP ${index + 1}: falta el proveedor`] : []),
      ...(!row.saldo.trim() ? [`CxP ${index + 1}: falta el saldo`] : []),
      ...(row.moneda !== monedaFuncional && !row.tasaCambio.trim() && !tasasEfectivas[row.moneda]
        ? [`CxP ${index + 1}: falta la tasa de ${row.moneda}`] : []),
    ]),
  ];
  const totals = calculateOpeningAccountTotals(accounts, monedaFuncional, tasasEfectivas);

  const submit = async () => {
    setSaving(true);
    try {
      // La revisión bloquea la confirmación mientras haya faltantes, así que
      // aquí cada cuenta está completa; los guardas son defensa en profundidad
      // y estrechan el payload parcial (borrador) al contrato completo que
      // exige la acción de inicialización.
      const payload = buildPayload();
      if (!payload.fechaCorte) {
        throw new Error('Falta la fecha de corte para confirmar');
      }
      const fechaCorteConfirm = payload.fechaCorte;
      const cuentas = payload.cuentas.map((cuenta) => {
        if (!cuenta.nombreCuenta || !cuenta.nombreBanco || !cuenta.numeroCuenta || !cuenta.saldoInicial) {
          throw new Error('Faltan datos de la cuenta para confirmar');
        }
        const origen = cuenta.origen;
        const tercero = origen?.tercero;
        if (origen && !tercero) {
          throw new Error('Falta el tercero de la cuenta para confirmar');
        }
        return {
          nombreCuenta: cuenta.nombreCuenta,
          nombreBanco: cuenta.nombreBanco,
          numeroCuenta: cuenta.numeroCuenta,
          tipoCuenta: cuenta.tipoCuenta,
          moneda: cuenta.moneda,
          saldoInicial: cuenta.saldoInicial,
          ...(cuenta.origenNoDocumentado ? { origenNoDocumentado: true } : {}),
          ...(origen && tercero
            ? {
              origen: {
                tipo: origen.tipo,
                tercero,
                ...(origen.tasaCambio ? { tasaCambio: origen.tasaCambio } : {}),
                ...(origen.tipoPagoId ? { tipoPagoId: origen.tipoPagoId } : {}),
                ...(origen.proveedorId ? { proveedorId: origen.proveedorId } : {}),
                ...(origen.tasaInteres ? { tasaInteres: origen.tasaInteres } : {}),
                ...(origen.tasaInteresMoratorio ? { tasaInteresMoratorio: origen.tasaInteresMoratorio } : {}),
                ...(origen.fechaVencimiento ? { fechaVencimiento: origen.fechaVencimiento } : {}),
              },
            }
            : {}),
        };
      });
      const initialInventory = inventory.map((row) => {
        if (!row.productoId || !row.almacenId || !row.loteCodigo.trim() || !row.cantidad.trim() || !row.costoUnitario.trim()) {
          throw new Error('Completa producto, almacén, lote, cantidad y costo del inventario inicial');
        }
        return {
          referenciaFila: row.referenciaFila,
          productoId: row.productoId,
          almacenId: row.almacenId,
          ...(row.ubicacionId ? { ubicacionId: row.ubicacionId } : {}),
          loteCodigo: row.loteCodigo.trim(),
          cantidad: row.cantidad.trim(),
          costoUnitario: row.costoUnitario.trim(),
          moneda: row.moneda,
          ...(fechaCorteConfirm ? { fechaCorte: fechaCorteConfirm } : row.fechaCorte ? { fechaCorte: row.fechaCorte } : {}),
          ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
          ...(row.tasaCambio ? { tasaCambio: row.tasaCambio.trim() } : {}),
        };
      });
      const initialReceivables = receivables.map((row) => {
        if (!row.clienteId || !row.saldo.trim() || Boolean(row.tasaInteres) !== Boolean(row.tasaInteresMoratorio)) {
          throw new Error('Completa cliente y saldo; los préstamos requieren ambas tasas de interés');
        }
        return {
          referenciaFila: row.referenciaFila,
          clienteId: row.clienteId,
          ...(row.referenciaExterna ? { referenciaExterna: row.referenciaExterna.trim() } : {}),
          moneda: row.moneda,
          saldo: row.saldo.trim(),
          ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
          ...(row.tasaCambio ? { tasaCambio: row.tasaCambio.trim() } : {}),
          ...(row.tasaInteres ? { tasaInteres: row.tasaInteres.trim() } : {}),
          ...(row.tasaInteresMoratorio ? { tasaInteresMoratorio: row.tasaInteresMoratorio.trim() } : {}),
        };
      });
      const initialPayables = payables.map((row) => {
        if (!row.proveedorId || !row.saldo.trim()) {
          throw new Error('Completa proveedor y saldo de la cuenta por pagar inicial');
        }
        return {
          referenciaFila: row.referenciaFila,
          proveedorId: row.proveedorId,
          ...(row.referenciaExterna ? { referenciaExterna: row.referenciaExterna.trim() } : {}),
          moneda: row.moneda,
          saldo: row.saldo.trim(),
          ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
          ...(row.tasaCambio ? { tasaCambio: row.tasaCambio.trim() } : {}),
        };
      });
      const confirmedBasePayload = {
        fechaCorte: fechaCorteConfirm,
        monedaFuncional: payload.monedaFuncional,
        ...(payload.tasas ? { tasas: payload.tasas } : {}),
      };
      const result = await initializeBankAccountsAction({
        idempotencyKey: key,
        ...confirmedBasePayload,
        cuentas,
        ...(inventory.length ? { inventario: initialInventory } : {}),
        ...(receivables.length ? { cuentasPorCobrar: initialReceivables } : {}),
        ...(payables.length ? { cuentasPorPagar: initialPayables } : {}),
      });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo inicializar la contabilidad');
      toast.success(result.data?.replayed ? 'Se recuperó la inicialización ya registrada' : 'Cuentas inicializadas');
      setAccounts([newAccount()]);
      setInventory([]);
      setReceivables([]);
      setPayables([]);
      setInitialRates({});
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
          <DialogTitle>Configurar saldos iniciales</DialogTitle>
          <DialogDescription>Registra las cuentas, existencias y obligaciones a la fecha de corte.</DialogDescription>
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
                  <Field label="Moneda"><Select value={account.moneda} onValueChange={(moneda) => update(index, { moneda })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{currencies.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent></Select></Field>
                  <Field label="Saldo inicial"><Input type="text" inputMode="decimal" value={account.saldoInicial} onChange={(e) => update(index, { saldoInicial: e.target.value, ...(Number(e.target.value) <= 0 ? { origen: '', tercero: '', tasaCambio: '', tipoPagoId: '' } : {}) })} /></Field>
                </div>
                {Number(account.saldoInicial) > 0 && <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Procedencia del saldo"><Select value={account.origen} onValueChange={(origen: Source) => update(index, { origen, tipoPagoId: '' })}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{canCapital && <SelectItem value="CAPITAL_SOCIAL">Inyección de capital</SelectItem>}{canCapital && <SelectItem value="PRESTAMO">Préstamo</SelectItem>}{canAdvance && <SelectItem value="ANTICIPO">Anticipo de cliente</SelectItem>}<SelectItem value="NO_DOCUMENTADO">No documentada</SelectItem></SelectContent></Select></Field>
                  {account.origen === 'NO_DOCUMENTADO' && <p role="note" className="text-sm text-muted-foreground">La procedencia no está documentada. No se clasifica como capital, préstamo o anticipo; su confirmación requiere conciliar la apertura contable.</p>}
                  {account.origen && account.origen !== 'NO_DOCUMENTADO' && !(account.origen === 'PRESTAMO' && canDebt && canPayable && account.proveedorId) && <Field label={account.origen === 'PRESTAMO' ? 'Prestamista' : account.origen === 'ANTICIPO' ? 'Cliente' : 'Socio'}><Input value={account.tercero} onChange={(e) => update(index, { tercero: e.target.value })} /></Field>}
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
                  {account.origen === 'PRESTAMO' && canDebt && canPayable && (
                    <>
                      <Field label="Proveedor relacionado (opcional)"><Select value={account.proveedorId} onValueChange={(proveedorId) => update(index, {
                        proveedorId: proveedorId === '__sin_vinculo__' ? '' : proveedorId,
                        tercero: proveedorId === '__sin_vinculo__'
                          ? account.tercero
                          : vendors.find((vendor) => vendor.id === proveedorId)?.nombre ?? account.tercero,
                      })}><SelectTrigger><SelectValue placeholder="Sin vínculo al submayor" /></SelectTrigger><SelectContent><SelectItem value="__sin_vinculo__">Sin vínculo al submayor</SelectItem>{vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.nombre}</SelectItem>)}</SelectContent></Select></Field>
                      {account.proveedorId && <>
                        <Field label="Interés ordinario"><Input inputMode="decimal" value={account.tasaInteres} onChange={(e) => update(index, { tasaInteres: e.target.value })} /></Field>
                        <Field label="Interés moratorio"><Input inputMode="decimal" value={account.tasaInteresMoratorio} onChange={(e) => update(index, { tasaInteresMoratorio: e.target.value })} /></Field>
                        <Field label="Vencimiento"><Input type="date" value={account.fechaVencimiento} onChange={(e) => update(index, { fechaVencimiento: e.target.value })} /></Field>
                      </>}
                    </>
                  )}
                  {account.moneda !== monedaFuncional && <Field label="Tasa a moneda funcional (si aplica)"><Input inputMode="decimal" value={account.tasaCambio} onChange={(e) => update(index, { tasaCambio: e.target.value })} /></Field>}
                </div>}
              </section>
            ))}
            <InitializationAdditionalSections
              canInventory={canInventory}
              canReceivable={canReceivable}
              canLoanReceivable={canLoanReceivable}
              canPayable={canPayable}
              monedaFuncional={monedaFuncional}
              currencies={currencies}
              products={products}
              warehouses={warehouses}
              clients={clients}
              vendors={vendors}
              inventory={inventory}
              receivables={receivables}
              payables={payables}
              onInventoryChange={setInventory}
              onReceivablesChange={setReceivables}
              onPayablesChange={setPayables}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de corte"><Input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} /></Field>
              <Field label="Moneda funcional"><Select value={monedaFuncional} onValueChange={setMonedaFuncional}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(hasFeature('multi-moneda') ? ['CUP', 'USD', 'MLC'] : ['CUP']).map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent></Select></Field>
            </div>
            {unpersistableDraftRateConflicts.length > 0 && (
              <p role="alert" className="text-sm text-destructive">
                {`No se puede guardar el borrador: las tasas ${unpersistableDraftRateConflicts.join(', ')} de cuentas no documentadas se perderían. Unifica las tasas antes de continuar.`}
              </p>
            )}
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setAccounts((rows) => [...rows, newAccount()])}
                disabled={accounts.length >= 100}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar cuenta
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={saveDraft} disabled={savingDraft || unpersistableDraftRateConflicts.length > 0}>{savingDraft ? 'Guardando…' : 'Guardar borrador'}</Button>
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
                <li>{`Inventario inicial: ${inventory.length} filas`}</li>
                <li>{`Cuentas por cobrar iniciales: ${receivables.length} filas`}</li>
                <li>{`Cuentas por pagar iniciales: ${payables.length} filas`}</li>
                {inventory.map((row, index) => (
                  <li key={row.referenciaFila}>{`Existencia ${index + 1}: ${products.find((item) => item.id === row.productoId)?.nombre ?? 'Producto pendiente'} · ${warehouses.find((item) => item.id === row.almacenId)?.nombre ?? 'Almacén pendiente'} · ${row.cantidad || 'Cantidad pendiente'} × ${row.costoUnitario || 'Costo pendiente'} ${row.moneda}`}</li>
                ))}
                {receivables.map((row, index) => (
                  <li key={row.referenciaFila}>{`CxC ${index + 1}: ${clients.find((item) => item.id === row.clienteId)?.nombre ?? 'Cliente pendiente'} · ${row.saldo || 'Saldo pendiente'} ${row.moneda}${row.referenciaExterna ? ` · ${row.referenciaExterna}` : ''}`}</li>
                ))}
                {payables.map((row, index) => (
                  <li key={row.referenciaFila}>{`CxP ${index + 1}: ${vendors.find((item) => item.id === row.proveedorId)?.nombre ?? 'Proveedor pendiente'} · ${row.saldo || 'Saldo pendiente'} ${row.moneda}${row.referenciaExterna ? ` · ${row.referenciaExterna}` : ''}`}</li>
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
              <Button type="button" className="min-h-11" onClick={submit} disabled={saving || faltantes.length > 0}>{saving ? 'Guardando…' : 'Inicializar empresa'}</Button>
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
