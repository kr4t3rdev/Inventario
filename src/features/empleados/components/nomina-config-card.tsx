'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getNominaConfigAction, upsertNominaConfigAction } from '@/features/empleados/actions-nomina-config';

interface NominaConfigCardProps {
  canConfigure: boolean;
}

/**
 * @description Configura el multiplicador y las horas estándar de nómina del tenant.
 * @param {NominaConfigCardProps} props - Permiso efectivo de configuración.
 * @returns {JSX.Element | null} Tarjeta editable solo para usuarios autorizados.
 */
export function NominaConfigCard({ canConfigure }: NominaConfigCardProps): React.JSX.Element | null {
  const [tarifa, setTarifa] = useState('1.5');
  const [horas, setHoras] = useState('192');
  const [moneda, setMoneda] = useState('CUP');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canConfigure) return;
    let active = true;
    getNominaConfigAction()
      .then((result) => {
        if (!active || !result.success) return;
        const config = result.data?.config;
        const defaults = result.data?.defaults;
        setTarifa(String(config?.tarifaHoraExtra ?? defaults?.tarifaHoraExtra ?? 1.5));
        setHoras(String(config?.horasMensualesEstandar ?? defaults?.horasMensualesEstandar ?? 192));
        setMoneda(config?.monedaPago ?? defaults?.monedaPago ?? 'CUP');
      })
      .catch(() => toast.error('No se pudo cargar la configuración de nómina.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canConfigure]);

  if (!canConfigure) return null;

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tarifaHoraExtra = Number(tarifa);
    const horasMensualesEstandar = Number(horas);
    if (!Number.isFinite(tarifaHoraExtra) || tarifaHoraExtra <= 0 || tarifaHoraExtra > 10 ||
      !Number.isInteger(horasMensualesEstandar) || horasMensualesEstandar < 20 ||
      horasMensualesEstandar > 300 || !/^[A-Z]{3}$/.test(moneda)) {
      toast.error('Revisa el multiplicador, las horas mensuales y el código de moneda.');
      return;
    }
    setSaving(true);
    try {
      const result = await upsertNominaConfigAction({
        tarifaHoraExtra,
        horasMensualesEstandar,
        monedaPago: moneda,
      });
      if (!result.success) throw new Error(result.error?.message ?? 'No se pudo guardar la configuración.');
      toast.success('Configuración de nómina guardada.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de nómina</CardTitle>
        <CardDescription>Parámetros del cálculo de horas extra y moneda de pago para este tenant.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5 text-sm font-medium">
            Multiplicador de hora extra
            <Input aria-label="Multiplicador de hora extra" type="number" min="0.01" max="10" step="0.01" value={tarifa} onChange={(event) => setTarifa(event.target.value)} disabled={loading || saving} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            Horas estándar mensuales
            <Input aria-label="Horas estándar mensuales" type="number" min="20" max="300" step="1" value={horas} onChange={(event) => setHoras(event.target.value)} disabled={loading || saving} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            Moneda de pago
            <Input aria-label="Moneda de pago" maxLength={3} value={moneda} onChange={(event) => setMoneda(event.target.value.toUpperCase())} disabled={loading || saving} />
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={loading || saving} className="w-full">{saving ? 'Guardando…' : 'Guardar configuración'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
