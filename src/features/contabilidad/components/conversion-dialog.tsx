'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ArrowRightLeft, Calculator, RotateCcw } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getMonedasAction, convertMoneyAction } from '@/features/contabilidad/actions-exchange';
import type { ExchangeCurrencyRecord, ExchangeQuote } from '@/features/contabilidad/services/exchange-types';
import { sileo } from '@/lib/sileo-shim';

const conversionSchema = z.object({
  monedaOrigen: z.string().min(1, 'Selecciona la moneda de origen'),
  monedaDestino: z.string().min(1, 'Selecciona la moneda de destino'),
  monto: z
    .string()
    .min(1, 'El monto es requerido')
    .refine((val) => {
      const num = Number(val);
      return !Number.isNaN(num) && num > 0;
    }, 'El monto debe ser un número positivo'),
});

type ConversionFormData = z.infer<typeof conversionSchema>;

interface ConversionDialogProps {
  onClose: () => void;
  onSuccess?: () => void;
  refreshKey?: number;
}

interface ConversionResult extends ExchangeQuote {
  montoConvertido: number;
  referenciaId?: string;
  tasaUsada?: number;
}

function formatDate(value?: string): string {
  if (!value) {
    return 'Sin fecha de vigencia';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

/**
 * @description Convierte monedas usando el quote determinístico del dominio de exchange.
 * @param {ConversionDialogProps} props - Props del diálogo de conversión.
 * @returns {JSX.Element} Diálogo de conversión con trazabilidad de la tasa aplicada.
 */
export function ConversionDialog({ onClose, onSuccess, refreshKey = 0 }: ConversionDialogProps) {
  const [monedas, setMonedas] = useState<ExchangeCurrencyRecord[]>([]);
  const [isLoadingMonedas, setIsLoadingMonedas] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [quote, setQuote] = useState<ConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<ConversionFormData>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      monedaOrigen: '',
      monedaDestino: '',
      monto: '',
    },
  });

  const selectedOrigin = useWatch({ control: form.control, name: 'monedaOrigen' });
  const selectedDestination = useWatch({ control: form.control, name: 'monedaDestino' });
  const selectedAmount = useWatch({ control: form.control, name: 'monto' });

  useEffect(() => {
    let active = true;

    const loadCurrencies = async (): Promise<void> => {
      setIsLoadingMonedas(true);
      const response = await getMonedasAction();

      if (!active) {
        return;
      }

      if (response.success) {
        setMonedas(response.data ?? []);
      }

      setIsLoadingMonedas(false);
    };

    void loadCurrencies();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const activeCurrencies = useMemo(
    () => monedas.filter((currency) => currency.isActive),
    [monedas],
  );
  const inactiveCurrencies = useMemo(
    () => monedas.filter((currency) => !currency.isActive),
    [monedas],
  );

  const originCurrency = useMemo(
    () => monedas.find((currency) => currency.codigo === selectedOrigin),
    [monedas, selectedOrigin],
  );
  const destinationCurrency = useMemo(
    () => monedas.find((currency) => currency.codigo === selectedDestination),
    [monedas, selectedDestination],
  );

  const canSubmit =
    !isConverting &&
    !isLoadingMonedas &&
    Boolean(selectedOrigin && selectedDestination && selectedAmount) &&
    originCurrency?.isActive !== false &&
    destinationCurrency?.isActive !== false;

  const handleSwapMonedas = (): void => {
    const origin = form.getValues('monedaOrigen');
    const destination = form.getValues('monedaDestino');

    form.setValue('monedaOrigen', destination, { shouldDirty: true, shouldValidate: true });
    form.setValue('monedaDestino', origin, { shouldDirty: true, shouldValidate: true });
    setQuote(null);
    setErrorMessage(null);
  };

  const handleReset = (): void => {
    form.reset();
    setQuote(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (data: ConversionFormData): Promise<void> => {
    setIsConverting(true);
    setErrorMessage(null);

    try {
      const response = await convertMoneyAction({
        monedaOrigen: data.monedaOrigen,
        monedaDestino: data.monedaDestino,
        monto: Number(data.monto),
      });

      if (!response.success) {
        const message = response.error?.message ?? 'Error al realizar la conversión';
        setQuote(null);
        setErrorMessage(message);
        sileo.error({ title: message });
        return;
      }

      const result = response.data as ConversionResult;
      setQuote(result);
      sileo.success({ title: 'Conversión realizada correctamente' });
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al realizar la conversión';
      setQuote(null);
      setErrorMessage(message);
      sileo.error({ title: message });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Convertidor de Monedas
          </DialogTitle>
          <DialogDescription>
            Convierte entre monedas activas usando la tasa aplicada por el dominio de exchange.
          </DialogDescription>
        </DialogHeader>

        {inactiveCurrencies.length > 0 && (
          <Card className="border-amber-200/80 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-900/10">
            <CardContent className="pt-4 text-sm text-amber-900 dark:text-amber-200">
              <div className="font-medium">Monedas inactivas detectadas</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {inactiveCurrencies.map((currency) => (
                  <Badge key={currency.codigo} variant="outline" className="border-amber-300">
                    {currency.codigo}
                    <span className="ml-2 text-xs uppercase tracking-wide">Inactiva</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="monedaOrigen"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda de Origen</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setQuote(null);
                        setErrorMessage(null);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Moneda de origen">
                          <SelectValue placeholder="Selecciona moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {monedas.map((currency) => (
                          <SelectItem key={currency.codigo} value={currency.codigo} disabled={!currency.isActive}>
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{currency.codigo}</span>
                              <span className="text-muted-foreground">
                                {currency.simbolo} - {currency.nombre}
                              </span>
                              {!currency.isActive && <Badge variant="secondary">Inactiva</Badge>}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {originCurrency
                        ? `${originCurrency.nombre} (${originCurrency.codigo})`
                        : 'Selecciona la moneda que será convertida'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monedaDestino"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda de Destino</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setQuote(null);
                        setErrorMessage(null);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Moneda de destino">
                          <SelectValue placeholder="Selecciona moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {monedas.map((currency) => (
                          <SelectItem key={currency.codigo} value={currency.codigo} disabled={!currency.isActive}>
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{currency.codigo}</span>
                              <span className="text-muted-foreground">
                                {currency.simbolo} - {currency.nombre}
                              </span>
                              {!currency.isActive && <Badge variant="secondary">Inactiva</Badge>}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {destinationCurrency
                        ? `${destinationCurrency.nombre} (${destinationCurrency.codigo})`
                        : 'Selecciona la moneda de destino'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSwapMonedas}
                disabled={!selectedOrigin || !selectedDestination}
                aria-label="Intercambiar monedas"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="monto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto a Convertir</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          setQuote(null);
                          setErrorMessage(null);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {originCurrency
                        ? `Monto en ${originCurrency.nombre} (${originCurrency.simbolo})`
                        : 'Monto que se va a convertir'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Card className="border-dashed border-slate-200/80 bg-slate-50/70 dark:border-slate-800/60 dark:bg-slate-900/10">
                <CardContent className="flex h-full flex-col justify-center gap-2 pt-4 text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">Trazabilidad de la conversión</div>
                  <div>La tasa se calcula en el servidor y se guarda con el resultado aplicado.</div>
                </CardContent>
              </Card>
            </div>

            {errorMessage && (
              <Card className="border-red-200/80 bg-red-50/80 dark:border-red-900/60 dark:bg-red-900/10">
                <CardContent className="flex items-start gap-3 pt-4 text-sm text-red-700 dark:text-red-200">
                  <RotateCcw className="mt-0.5 h-4 w-4" />
                  <div>
                    <div className="font-medium">No se pudo completar la conversión</div>
                    <p>{errorMessage}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {quote && (
              <Card>
                <CardHeader>
                  <CardTitle>Resultado de la conversión</CardTitle>
                  <CardDescription>
                    Quote determinístico con trazabilidad completa de la tasa utilizada.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Monto original</div>
                      <div className="text-lg font-semibold">
                        {quote.montoOriginal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        {quote.monedaOrigen}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Monto convertido</div>
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-300">
                        {quote.montoConvertido.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        {quote.monedaDestino}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Ruta {quote.ruta}</Badge>
                    <Badge variant="outline">Tasa ID {quote.tasaId ?? 'sin identificador'}</Badge>
                    <Badge variant="outline">
                      Tasa aplicada {quote.tasaAplicada.toLocaleString('es-ES', {
                        minimumFractionDigits: 6,
                        maximumFractionDigits: 6,
                      })}
                    </Badge>
                    <Badge variant="outline">Efectiva {formatDate(quote.effectiveAt)}</Badge>
                    <Badge variant="outline">Proveedor {quote.proveedor ?? 'Sistema'}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={quote ? handleReset : onClose}>
                {quote ? 'Nueva Conversión' : 'Cerrar'}
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                aria-busy={isConverting}
              >
                {isConverting ? 'Convirtiendo...' : 'Convertir'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
