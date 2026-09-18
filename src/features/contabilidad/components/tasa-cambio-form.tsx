'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  getMonedasAction,
  getTasasActualesAction,
  updateTasaCambioAction,
} from '@/features/contabilidad/actions-exchange';
import type {
  ExchangeCurrentRate,
  ExchangeCurrentRatesResult,
  ExchangeCurrencyRecord,
} from '@/features/contabilidad/services/exchange-types';
import { sileo } from '@/lib/sileo-shim';

const tasaCambioSchema = z.object({
  monedaOrigenId: z.string().min(1, 'Selecciona la moneda de origen'),
  tasa: z
    .string()
    .min(1, 'La tasa es requerida')
    .refine((val) => {
      const num = Number(val);
      return !Number.isNaN(num) && num > 0;
    }, 'La tasa debe ser un número positivo'),
});

type TasaCambioFormData = z.infer<typeof tasaCambioSchema>;

interface TasaCambioFormProps {
  onClose: () => void;
  onSuccess: () => void;
  refreshKey?: number;
}

function formatRate(value: number): string {
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

/**
 * @description Registra una nueva tasa contra la moneda principal y muestra la tasa vigente a sobrescribir.
 * @param {TasaCambioFormProps} props - Props del formulario de tasa.
 * @returns {JSX.Element} Diálogo de alta/edición de tasas con contexto de la moneda principal.
 */
export function TasaCambioForm({ onClose, onSuccess, refreshKey = 0 }: TasaCambioFormProps) {
  const [monedas, setMonedas] = useState<ExchangeCurrencyRecord[]>([]);
  const [currentRates, setCurrentRates] = useState<ExchangeCurrentRatesResult | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewConversion, setPreviewConversion] = useState<{
    origen: number;
    destino: number;
  } | null>(null);

  const form = useForm<TasaCambioFormData>({
    resolver: zodResolver(tasaCambioSchema),
    defaultValues: {
      monedaOrigenId: '',
      tasa: '',
    },
  });

  const watchedMonedaOrigenId = useWatch({ control: form.control, name: 'monedaOrigenId' });
  const watchedTasa = useWatch({ control: form.control, name: 'tasa' });

  useEffect(() => {
    let active = true;

    const loadData = async (): Promise<void> => {
      setIsLoadingData(true);

      const [monedasResponse, tasasResponse] = await Promise.all([
        getMonedasAction(),
        getTasasActualesAction(),
      ]);

      if (!active) {
        return;
      }

      if (monedasResponse.success) {
        setMonedas(monedasResponse.data ?? []);
      }

      if (tasasResponse.success) {
        setCurrentRates(tasasResponse.data ?? null);
      }

      setIsLoadingData(false);
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (watchedTasa && !Number.isNaN(Number(watchedTasa))) {
      setPreviewConversion({
        origen: 1,
        destino: Number(watchedTasa),
      });
      return;
    }

    setPreviewConversion(null);
  }, [watchedTasa]);

  const principalCurrency = useMemo(
    () => currentRates?.monedaPrincipal ?? monedas.find((currency) => currency.esPrincipal) ?? null,
    [currentRates?.monedaPrincipal, monedas],
  );

  const activeSecondaryCurrencies = useMemo(
    () => monedas.filter((currency) => currency.isActive && !currency.esPrincipal),
    [monedas],
  );

  const selectedCurrency = useMemo(
    () => activeSecondaryCurrencies.find((currency) => currency.codigo === watchedMonedaOrigenId) ?? null,
    [activeSecondaryCurrencies, watchedMonedaOrigenId],
  );

  const currentRate = useMemo<ExchangeCurrentRate | null>(() => {
    if (!principalCurrency || !watchedMonedaOrigenId) {
      return null;
    }

    return (
      currentRates?.tasas.find(
        (rate) =>
          rate.monedaOrigenId === watchedMonedaOrigenId &&
          rate.monedaDestino === principalCurrency.codigo,
      ) ?? null
    );
  }, [currentRates?.tasas, principalCurrency, watchedMonedaOrigenId]);

  const handleSubmit = async (data: TasaCambioFormData): Promise<void> => {
    setIsSubmitting(true);

    try {
      const response = await updateTasaCambioAction({
        monedaOrigenId: data.monedaOrigenId,
        monedaDestino: principalCurrency?.codigo ?? '',
        tasa: Number(data.tasa),
      });

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Error al actualizar tasa');
      }

      sileo.success({ title: 'Tasa de cambio actualizada correctamente' });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar la tasa de cambio';
      console.error('Error al actualizar tasa:', error);
      sileo.error({ title: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRateLabel = currentRate
    ? `${formatRate(Number(currentRate.tasa))} ${principalCurrency?.codigo ?? ''}`
    : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Actualizar Tasa de Cambio</DialogTitle>
          <DialogDescription>
            Define la tasa de conversión hacia la moneda principal con trazabilidad explícita.
          </DialogDescription>
        </DialogHeader>

        {principalCurrency && (
          <Card className="border-blue-200/80 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-900/10">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-base">Moneda principal activa</CardTitle>
              <CardDescription>Base de referencia para todas las conversiones del módulo.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 pt-0">
              <Badge variant="outline">{principalCurrency.codigo}</Badge>
              <span className="text-sm text-muted-foreground">
                {principalCurrency.nombre} · {principalCurrency.simbolo}
              </span>
            </CardContent>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="monedaOrigenId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda de Origen</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setPreviewConversion(null);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Moneda de origen">
                        <SelectValue placeholder="Selecciona una moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeSecondaryCurrencies.map((currency) => (
                        <SelectItem key={currency.codigo} value={currency.codigo}>
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{currency.codigo}</span>
                            <span className="text-muted-foreground">
                              {currency.simbolo} - {currency.nombre}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Moneda que se convertirá a {principalCurrency?.codigo ?? 'la moneda principal'}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tasa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tasa de Cambio</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.000001"
                      min="0"
                      placeholder="0.000000"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Cuántas unidades de {principalCurrency?.codigo ?? 'la moneda principal'} equivalen a 1{' '}
                    {selectedCurrency?.codigo ?? 'unidad de moneda origen'}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedCurrency && currentRate && principalCurrency && (
              <Card className="border-amber-200/80 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-900/10">
                <CardHeader className="space-y-1 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Sobrescribirá la tasa vigente
                  </CardTitle>
                  <CardDescription>
                    La entrada actual se conserva en el historial, pero esta operación reemplaza el valor vigente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Tasa ID {currentRate.tasaId}</Badge>
                    <Badge variant="outline">Ruta {currentRate.ruta}</Badge>
                    <Badge variant="outline">Proveedor {currentRate.proveedor ?? 'Sistema'}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    Vigente {currentRate.effectiveAt} · {currentRateLabel}
                  </div>
                </CardContent>
              </Card>
            )}

            {previewConversion && selectedCurrency && principalCurrency && (
              <Card>
                <CardContent className="pt-4">
                  <div className="mb-2 text-sm text-muted-foreground">Vista previa de conversión</div>
                  <div className="flex items-center justify-center gap-4 text-lg">
                    <div className="text-center">
                      <div className="font-bold">{previewConversion.origen}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedCurrency.simbolo} {selectedCurrency.codigo}
                      </div>
                    </div>
                    <div className="text-muted-foreground">=</div>
                    <div className="text-center">
                      <div className="font-bold text-primary">{previewConversion.destino.toFixed(6)}</div>
                      <div className="text-sm text-muted-foreground">
                        {principalCurrency.simbolo} {principalCurrency.codigo}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoadingData || !principalCurrency}>
                {isSubmitting ? 'Actualizando...' : 'Actualizar Tasa'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
