'use client';

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { getAlmacenesAction } from '@/features/almacenes/actions';
import { getClientesAction } from '@/features/clientes/actions';
import { getVendorsAction } from '@/features/vendors/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { initializeBankAccountsAction } from '@/features/contabilidad/actions-cuentas-bancarias';
import { guardarBorradorInicializacionAction, obtenerBorradorActualInicializacionAction } from '@/features/contabilidad/actions-inicializacion-borrador';
import { getTiposPagoAction } from '@/features/contabilidad/actions-tipos-pago';
import { getProductosAction } from '@/features/productos/actions-crud';
import { toInitialInventoryDraft, type InitialInventoryDraft } from '../services/initialization-additional-drafts';
import { toInitialReceivableDraft, type InitialReceivableDraft } from '../services/initialization-additional-drafts';
import { toInitialPayableDraft, type InitialPayableDraft } from '../services/initialization-additional-drafts';
import { InitialInventoryOpeningSection } from './initial-inventory-opening-section';
import { InitialPayablesOpeningSection } from './initial-payables-opening-section';
import { InitialReceivablesOpeningSection } from './initial-receivables-opening-section';

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
    saldoInicial: typeof raw.saldoInicial === 'string' ? raw.saldoInicial : '',
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
 * @param inventory - Existencias iniciales que deben quedar completas antes de confirmar.
 * @param receivables - Cuentas por cobrar iniciales externas.
 * @param payables - Cuentas por pagar iniciales externas.
 * @returns Faltantes en texto, vacía si no hay nada que impida confirmar.
 */
function computeFaltantes(
  accounts: AccountDraft[],
  fechaCorte: string,
  monedaFuncional: string,
  inventory: InitialInventoryDraft[] = [],
  receivables: InitialReceivableDraft[] = [],
  payables: InitialPayableDraft[] = [],
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
    if (account.moneda !== monedaFuncional && account.tasaCambio.trim() === '') {
      faltantes.push(`${label}: falta la tasa a moneda funcional (${account.moneda} → ${monedaFuncional})`);
    }
  });
  inventory.forEach((row, index) => {
    const label = `Existencia ${index + 1}`;
    const quantity = Number(row.cantidad);
    const cost = Number(row.costoUnitario);
    if (!row.productoId) faltantes.push(`${label}: falta el producto`);
    if (!row.almacenId) faltantes.push(`${label}: falta el almacén`);
    if (!row.loteCodigo.trim()) faltantes.push(`${label}: falta el lote`);
    if (!row.cantidad.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      faltantes.push(`${label}: falta una cantidad mayor que cero`);
    }
    if (!row.costoUnitario.trim() || !Number.isFinite(cost) || cost < 0) {
      faltantes.push(`${label}: falta el costo unitario`);
    }
    if (row.moneda !== monedaFuncional && !row.tasaCambio.trim()) {
      faltantes.push(`${label}: falta la tasa de cambio del inventario`);
    }
  });
  receivables.forEach((row, index) => {
    const label = `Cuenta por cobrar ${index + 1}`;
    if (!row.clienteId) faltantes.push(`${label}: falta el cliente`);
    if (!/^\d{1,16}(?:\.\d{1,4})?$/.test(row.saldo) || !/[1-9]/.test(row.saldo)) {
      faltantes.push(`${label}: falta un saldo mayor que cero`);
    }
    const validFxRate = /^\d+(?:\.\d{1,8})?$/.test(row.tasaCambio) && Number(row.tasaCambio) > 0;
    if (row.moneda !== monedaFuncional && !validFxRate) {
      faltantes.push(`${label}: falta una tasa de cambio mayor que cero`);
    }
    if (Boolean(row.tasaInteres.trim()) !== Boolean(row.tasaInteresMoratorio.trim()) ||
      (row.tasaInteres.trim() !== '' && (!/^\d+(?:\.\d{1,10})?$/.test(row.tasaInteres) || Number(row.tasaInteres) < 0)) ||
      (row.tasaInteresMoratorio.trim() !== '' && (!/^\d+(?:\.\d{1,10})?$/.test(row.tasaInteresMoratorio) || Number(row.tasaInteresMoratorio) < 0))) {
      faltantes.push(`${label}: verifica las tasas de interés del préstamo`);
    }
  });
  payables.forEach((row, index) => {
    const label = `Cuenta por pagar ${index + 1}`;
    if (!row.proveedorId) faltantes.push(`${label}: falta el proveedor`);
    if (!/^\d{1,16}(?:\.\d{1,4})?$/.test(row.saldo) || !/[1-9]/.test(row.saldo)) {
      faltantes.push(`${label}: falta un saldo mayor que cero`);
    }
    if (row.moneda !== monedaFuncional &&
      (!/^\d+(?:\.\d{1,8})?$/.test(row.tasaCambio) || Number(row.tasaCambio) <= 0)) {
      faltantes.push(`${label}: falta una tasa de cambio mayor que cero`);
    }
  });
  return faltantes;
}

/**
 * @description Suma los saldos por moneda y el total en moneda funcional con las tasas declaradas.
 * @param accounts - Cuentas del formulario.
 * @param monedaFuncional - Moneda funcional del formulario.
 * @param receivables - Cuentas por cobrar externas capturadas.
 * @param payables - Cuentas por pagar externas capturadas.
 * @returns Subtotales por moneda y total funcional (null si falta una tasa).
 */
function computeTotals(accounts: AccountDraft[], monedaFuncional: string, receivables: InitialReceivableDraft[] = [], payables: InitialPayableDraft[] = []): { porMoneda: Array<{ moneda: string; total: number }>; funcional: number | null } {
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
  receivables.forEach((row) => {
    if (row.saldo.trim() === '' || !Number.isFinite(Number(row.saldo))) return;
    const saldo = Number(row.saldo);
    porMoneda.set(row.moneda, (porMoneda.get(row.moneda) ?? 0) + saldo);
    if (row.moneda === monedaFuncional) funcional += saldo;
    else if (!/^\d+(?:\.\d{1,8})?$/.test(row.tasaCambio) || Number(row.tasaCambio) <= 0) sinValorar = true;
    else funcional += saldo * Number(row.tasaCambio);
  });
  payables.forEach((row) => {
    if (row.saldo.trim() === '' || !Number.isFinite(Number(row.saldo))) return;
    const saldo = Number(row.saldo);
    porMoneda.set(row.moneda, (porMoneda.get(row.moneda) ?? 0) + saldo);
    if (row.moneda === monedaFuncional) funcional += saldo;
    else if (!/^\d+(?:\.\d{1,8})?$/.test(row.tasaCambio) || Number(row.tasaCambio) <= 0) sinValorar = true;
    else funcional += saldo * Number(row.tasaCambio);
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
  const { user } = useAuth();
  const canInventory = user?.role === 'admin' || user?.planFeatures?.productos === true;
  const canReceivables = user?.role === 'admin' || (
    user?.planFeatures?.clientes === true && user?.planFeatures?.['cuentas-cobrar'] === true
  );
  const canPayables = user?.role === 'admin' || (
    user?.planFeatures?.proveedores === true && user?.planFeatures?.['cuentas-pagar'] === true
  );
  const canLoanReceivable = user?.role === 'admin' || user?.planFeatures?.['prestamos-cash'] === true;
  const canMultiCurrency = user?.role === 'admin' || user?.planFeatures?.['multi-moneda'] === true;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [accounts, setAccounts] = useState<AccountDraft[]>([newAccount()]);
  const [inventory, setInventory] = useState<InitialInventoryDraft[]>([]);
  const [receivables, setReceivables] = useState<InitialReceivableDraft[]>([]);
  const [payables, setPayables] = useState<InitialPayableDraft[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; nombre: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; nombre: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; nombre: string }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; nombre: string }>>([]);
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
    if (canInventory) {
      void getProductosAction().then((result) => {
        if (result.success) setProducts((result.data ?? []).map((item) => ({ id: item.id, nombre: item.nombre })));
        else toast.error(result.error?.message || 'No se pudieron cargar los productos');
      });
      void getAlmacenesAction().then((result) => {
        if (result.success) setWarehouses((result.data ?? []).map((item) => ({ id: item.almacenId, nombre: item.nombre })));
        else toast.error(result.error?.message || 'No se pudieron cargar los almacenes');
      });
    }
    if (canReceivables) {
      void getClientesAction().then((result) => {
        if (result.success) setClients((result.data ?? []).map((item) => ({ id: item.clienteId, nombre: item.nombre })));
        else toast.error(result.error?.message || 'No se pudieron cargar los clientes');
      });
    }
    if (canPayables) {
      void getVendorsAction().then((result) => {
        if (result.success) setSuppliers((result.data ?? []).map((item) => ({ id: item.vendorId, nombre: item.nombre })));
        else toast.error(result.error?.message || 'No se pudieron cargar los proveedores');
      });
    }
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
      setFechaCorte(typeof draft.fechaCorte === 'string' && draft.fechaCorte.trim() ? draft.fechaCorte : '');
      if (cuentasRaw.length > 0) {
        setAccounts(cuentasRaw.map((raw) => toAccountDraft(raw as Record<string, unknown>, tasas, funcional)));
      }
      setInventory(canInventory && Array.isArray(draft.inventario)
        ? draft.inventario.map(toInitialInventoryDraft)
        : []);
      setReceivables(Array.isArray(draft.cuentasPorCobrar)
        ? draft.cuentasPorCobrar.map(toInitialReceivableDraft)
        : []);
      setPayables(Array.isArray(draft.cuentasPorPagar)
        ? draft.cuentasPorPagar.map(toInitialPayableDraft)
        : []);
      setKey(result.data.idempotencyKey);
      setResumed(true);
    });
  }, [open, canInventory, canReceivables, canPayables]);

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
      ...(fechaCorte.trim() ? { fechaCorte: fechaCorte.trim() } : {}),
      monedaFuncional,
      ...(Object.keys(tasas).length > 0 ? { tasas } : {}),
      ...(canInventory && inventory.length ? { inventario: inventory.map((row) => ({
        referenciaFila: row.referenciaFila,
        ...(row.productoId ? { productoId: row.productoId } : {}),
        ...(row.almacenId ? { almacenId: row.almacenId } : {}),
        ...(row.ubicacionId ? { ubicacionId: row.ubicacionId } : {}),
        ...(row.loteCodigo ? { loteCodigo: row.loteCodigo } : {}),
        ...(row.cantidad.trim() ? { cantidad: row.cantidad.trim() } : {}),
        ...(row.costoUnitario.trim() ? { costoUnitario: row.costoUnitario.trim() } : {}),
        moneda: row.moneda,
        ...(row.tasaCambio.trim() ? { tasaCambio: row.tasaCambio.trim() } : {}),
        ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
      })) } : {}),
      ...(receivables.length ? { cuentasPorCobrar: receivables.map((row) => ({
        referenciaFila: row.referenciaFila,
        moneda: row.moneda,
        ...(row.clienteId ? { clienteId: row.clienteId } : {}),
        ...(row.referenciaExterna.trim() ? { referenciaExterna: row.referenciaExterna.trim() } : {}),
        ...(row.saldo.trim() ? { saldo: row.saldo.trim() } : {}),
        ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
        ...(row.moneda !== monedaFuncional && row.tasaCambio.trim() ? { tasaCambio: row.tasaCambio.trim() } : {}),
        ...(row.tasaInteres.trim() ? { tasaInteres: row.tasaInteres.trim() } : {}),
        ...(row.tasaInteresMoratorio.trim() ? { tasaInteresMoratorio: row.tasaInteresMoratorio.trim() } : {}),
      })) } : {}),
      ...(payables.length ? { cuentasPorPagar: payables.map((row) => ({
        referenciaFila: row.referenciaFila,
        moneda: row.moneda,
        ...(row.proveedorId ? { proveedorId: row.proveedorId } : {}),
        ...(row.referenciaExterna.trim() ? { referenciaExterna: row.referenciaExterna.trim() } : {}),
        ...(row.saldo.trim() ? { saldo: row.saldo.trim() } : {}),
        ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
        ...(row.moneda !== monedaFuncional && row.tasaCambio.trim() ? { tasaCambio: row.tasaCambio.trim() } : {}),
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

  const planRestrictions = [
    ...(!canReceivables && receivables.length
      ? ['El plan actual ya no permite confirmar las CxC guardadas. Restaura el acceso antes de guardar o confirmar.']
      : []),
    ...(!canLoanReceivable && receivables.some((row) => row.tasaInteres.trim() || row.tasaInteresMoratorio.trim())
      ? ['El plan actual ya no permite préstamos con submayor. Restaura el acceso antes de guardar o confirmar.']
      : []),
    ...(!canMultiCurrency && receivables.some((row) => row.moneda !== monedaFuncional)
      ? ['El plan actual ya no permite CxC en moneda extranjera. Restaura el acceso antes de guardar o confirmar.']
      : []),
    ...(!canPayables && payables.length
      ? ['El plan actual ya no permite confirmar las CxP guardadas. Restaura el acceso antes de guardar o confirmar.']
      : []),
    ...(!canMultiCurrency && payables.some((row) => row.moneda !== monedaFuncional)
      ? ['El plan actual ya no permite CxP en moneda extranjera. Restaura el acceso antes de guardar o confirmar.']
      : []),
  ];

  const saveDraft = async () => {
    if (planRestrictions.length) {
      toast.error(planRestrictions[0]);
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

  const faltantes = [...computeFaltantes(accounts, fechaCorte, monedaFuncional, inventory, receivables, payables), ...planRestrictions];
  const totals = computeTotals(accounts, monedaFuncional, receivables, payables);

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
      if (planRestrictions.length) throw new Error(planRestrictions[0]);
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
              },
            }
            : {}),
        };
      });
      const initialInventory = inventory.map((row) => {
        if (!row.productoId || !row.almacenId || !row.loteCodigo.trim()
          || !row.cantidad.trim() || !row.costoUnitario.trim()) {
          throw new Error('Completa producto, almacén, lote, cantidad y costo del inventario inicial');
        }
        return {
          referenciaFila: row.referenciaFila,
          productoId: row.productoId,
          almacenId: row.almacenId,
          loteCodigo: row.loteCodigo.trim(),
          cantidad: row.cantidad.trim(),
          costoUnitario: row.costoUnitario.trim(),
          moneda: row.moneda,
          fechaCorte: fechaCorteConfirm,
          ...(row.ubicacionId ? { ubicacionId: row.ubicacionId } : {}),
          ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
          ...(row.tasaCambio ? { tasaCambio: row.tasaCambio.trim() } : {}),
        };
      });
      const initialReceivables = receivables.map((row) => {
        if (!row.clienteId || !row.saldo.trim() || Number(row.saldo) <= 0) {
          throw new Error('Completa el cliente y un saldo mayor que cero para cada CxC');
        }
        return {
          referenciaFila: row.referenciaFila, clienteId: row.clienteId, moneda: row.moneda, saldo: row.saldo.trim(),
          ...(row.referenciaExterna.trim() ? { referenciaExterna: row.referenciaExterna.trim() } : {}),
          ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
          ...(row.moneda !== monedaFuncional && row.tasaCambio.trim() ? { tasaCambio: row.tasaCambio.trim() } : {}),
          ...(row.tasaInteres.trim() && row.tasaInteresMoratorio.trim()
            ? { tasaInteres: row.tasaInteres.trim(), tasaInteresMoratorio: row.tasaInteresMoratorio.trim() }
            : {}),
        };
      });
      const initialPayables = payables.map((row) => {
        if (!row.proveedorId || !row.saldo.trim() || Number(row.saldo) <= 0) {
          throw new Error('Completa el proveedor y un saldo mayor que cero para cada CxP');
        }
        return {
          referenciaFila: row.referenciaFila, proveedorId: row.proveedorId,
          moneda: row.moneda, saldo: row.saldo.trim(),
          ...(row.referenciaExterna.trim() ? { referenciaExterna: row.referenciaExterna.trim() } : {}),
          ...(row.fechaVencimiento ? { fechaVencimiento: row.fechaVencimiento } : {}),
          ...(row.moneda !== monedaFuncional && row.tasaCambio.trim() ? { tasaCambio: row.tasaCambio.trim() } : {}),
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
        ...(canInventory && initialInventory.length ? { inventario: initialInventory } : {}),
        ...(canReceivables && initialReceivables.length ? { cuentasPorCobrar: initialReceivables } : {}),
        ...(canPayables && initialPayables.length ? { cuentasPorPagar: initialPayables } : {}),
      });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo inicializar la contabilidad');
      toast.success(result.data?.replayed ? 'Se recuperó la inicialización ya registrada' : 'Cuentas inicializadas');
      setAccounts([newAccount()]);
      setInventory([]);
      setReceivables([]);
      setPayables([]);
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
            {planRestrictions.map((issue) => <p key={issue} role="alert">{issue}</p>)}
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
            {canInventory && (
              <InitialInventoryOpeningSection
                rows={inventory}
                products={products}
                warehouses={warehouses}
                currencies={user?.planFeatures?.['multi-moneda'] ? ['CUP', 'USD', 'MLC'] : [monedaFuncional]}
                functionalCurrency={monedaFuncional}
                onChange={setInventory}
              />
            )}
            {canReceivables && <InitialReceivablesOpeningSection
              rows={receivables} clients={clients}
              currencies={canMultiCurrency ? ['CUP', 'USD', 'MLC'] : [monedaFuncional]}
              functionalCurrency={monedaFuncional} canLoanReceivable={canLoanReceivable} onChange={setReceivables}
            />}
            {canPayables && <InitialPayablesOpeningSection
              rows={payables} suppliers={suppliers}
              currencies={canMultiCurrency ? ['CUP', 'USD', 'MLC'] : [monedaFuncional]}
              functionalCurrency={monedaFuncional} onChange={setPayables}
            />}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de corte"><Input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} /></Field>
              <Field label="Moneda funcional"><Select value={monedaFuncional} onValueChange={setMonedaFuncional}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CUP">CUP</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="MLC">MLC</SelectItem></SelectContent></Select></Field>
            </div>
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
                <Button type="button" variant="outline" className="min-h-11" onClick={saveDraft} disabled={savingDraft || planRestrictions.length > 0}>{savingDraft ? 'Guardando…' : 'Guardar borrador'}</Button>
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
              {receivables.length > 0 && <ul className="space-y-2">{receivables.map((row, index) => (
                <li key={row.referenciaFila}>{`CxC ${index + 1} — ${clients.find((client) => client.id === row.clienteId)?.nombre || 'Cliente pendiente'} · ${row.saldo || 'Sin saldo'} ${row.moneda}${row.fechaVencimiento ? ` · vence ${row.fechaVencimiento}` : ''}`}</li>
              ))}</ul>}
              {payables.length > 0 && <ul className="space-y-2">{payables.map((row, index) => (
                <li key={row.referenciaFila}>{`CxP ${index + 1} — ${suppliers.find((supplier) => supplier.id === row.proveedorId)?.nombre || 'Proveedor pendiente'} · ${row.saldo || 'Sin saldo'} ${row.moneda}${row.fechaVencimiento ? ` · vence ${row.fechaVencimiento}` : ''}`}</li>
              ))}</ul>}
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
