'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, Save, X } from 'lucide-react';
import { sileo } from '@/lib/sileo-shim';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateCuentaBancariaMutation,
  useGetMonedasQuery,
  useGetTiposPagoQuery,
  useUpdateCuentaBancariaMutation,
} from '@/features/contabilidad/api/contabilidadApi';
import { cn } from '@/lib/utils';

import type { CuentaBancaria } from '@/app/models/model';
import { showSuccessToast } from './toast-notifications';

const cuentaBancariaSchema = z.object({
  nombreBanco: z
    .string()
    .min(1, 'El nombre del banco es requerido')
    .max(100, 'Máximo 100 caracteres'),
  numeroCuenta: z
    .string()
    .min(1, 'El número de cuenta es requerido')
    .max(50, 'Máximo 50 caracteres'),
  tipoCuenta: z.string().min(1, 'El tipo de cuenta es requerido'),
  saldo: z.number().min(0, 'El saldo no puede ser negativo'),
  moneda: z.string().min(1, 'Seleccione una moneda'),
  isActive: z.boolean().optional(),
});

type CuentaBancariaFormData = z.infer<typeof cuentaBancariaSchema>;

interface CuentaBancariaFormProps {
  cuenta?: CuentaBancaria;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const surfaceCardClass = cn(
  'w-full max-w-2xl border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

const labelClass = cn(
  'text-sm font-medium text-slate-700',
  'dark:text-slate-200',
);

const inputClass = cn(
  'placeholder:text-slate-400 transition-all duration-300',
  'border-slate-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40',
  'dark:border-slate-800/60 dark:focus:bg-slate-900/10',
);

const outlineButtonClass = cn(
  'border-slate-200/70 bg-white/50 text-slate-700 shadow-sm transition-all duration-300',
  'hover:bg-white hover:border-blue-500/40 hover:text-blue-600 hover:shadow-md',
  'dark:border-slate-800/60 dark:bg-slate-900/10 dark:text-slate-200',
  'dark:hover:bg-slate-950 dark:hover:border-blue-400/40 dark:hover:text-blue-400',
);

/**
 * @description Formulario para crear o editar cuentas bancarias.
 * @param {CuentaBancariaFormProps} props - Props del formulario.
 * @returns {JSX.Element} Formulario de cuenta bancaria.
 */
export function CuentaBancariaForm({
  cuenta,
  onSuccess,
  onCancel,
}: CuentaBancariaFormProps): React.JSX.Element {
  const [createCuenta, { isLoading: isCreating }] = useCreateCuentaBancariaMutation();
  const [updateCuenta, { isLoading: isUpdating }] = useUpdateCuentaBancariaMutation();
  const { data: moneda } = useGetMonedasQuery();
  const { data: tiposPago } = useGetTiposPagoQuery({
    includeInactive: false,
    requiereCuenta: false,
  });

  const shouldReduceMotion = useReducedMotion();

  const fadeInUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: 'easeOut' as const,
      },
    },
  };

  const stagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.06,
      },
    },
  };

  const tiposCuenta = Array.isArray(tiposPago) ? tiposPago : tiposPago?.data || [];
  const monedasDisponibles = moneda?.data || [];

  const form = useForm<CuentaBancariaFormData>({
    resolver: zodResolver(cuentaBancariaSchema),
    defaultValues: {
      nombreBanco: cuenta?.nombreBanco || '',
      numeroCuenta: cuenta?.numeroCuenta || '',
      tipoCuenta: (cuenta?.tipoCuenta as 'corriente' | 'ahorros' | 'empresarial') || 'corriente',
      saldo: cuenta?.saldo ? parseFloat(cuenta.saldo.toString()) : 0,
      moneda: cuenta?.moneda || 'CUP',
      isActive: cuenta?.isActive ?? true,
    },
  });

  const isLoading = isCreating || isUpdating;
  const isEditing = !!cuenta;

  /**
   * @description Envía el formulario para crear o actualizar una cuenta bancaria.
   * @param {CuentaBancariaFormData} data - Datos del formulario.
   * @returns {Promise<void>} Promesa al finalizar la operación.
   */
  const onSubmit = async (data: CuentaBancariaFormData): Promise<void> => {
    try {
      if (isEditing && cuenta) {
        await updateCuenta({
          id: cuenta.cuentaId,
          nombreBanco: data.nombreBanco,
          tipoCuenta: data.tipoCuenta,
          moneda: data.moneda,
          isActive: data.isActive ?? true,
        }).unwrap();
        showSuccessToast.accountUpdated(data.nombreBanco);
      } else {
        await createCuenta(data).unwrap();
        showSuccessToast.accountCreated(data.nombreBanco);
      }

      onSuccess?.();
    } catch (error: unknown) {
      console.error('Error al procesar cuenta bancaria:', error);

      let errorMessage = 'Error al procesar la cuenta bancaria';

      if (error && typeof error === 'object') {
        const apiError = error as any;

        if (apiError?.serializedError) {
          errorMessage = apiError.message || 'Error desconocido';
        } else if (apiError?.data?.error) {
          errorMessage = apiError.data.error;
        } else if (apiError?.message) {
          errorMessage = apiError.message;
        } else if (apiError?.status === 409 || apiError?.status === 400) {
          if (apiError?.data?.code === 'ACCOUNT_NUMBER_EXISTS') {
            errorMessage = 'Ya existe una cuenta con este número';
          } else if (apiError?.data?.code === 'VALIDATION_ERROR') {
            errorMessage = 'Datos inválidos. Verifique la información ingresada';
          } else {
            errorMessage = apiError?.data?.error || 'Datos inválidos';
          }
        } else if (apiError?.status >= 500) {
          errorMessage = 'Error del servidor. Intente nuevamente más tarde';
        } else if (apiError?.status === 'FETCH_ERROR') {
          errorMessage = 'Error de conexión. Verifique su conexión a internet';
        }
      }

      sileo.error({ title: errorMessage });
    }
  };

  return (
    <Form {...form}>
      <motion.form
        onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })}
        className="space-y-6 p-1"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <motion.div variants={fadeInUp} className="col-span-2 md:col-span-1">
            <FormField
              control={form.control}
              name="nombreBanco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Nombre del banco</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Ej: Banco Popular de Ahorro"
                        {...field}
                        disabled={isLoading}
                        className={inputClass}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={fadeInUp} className="col-span-2 md:col-span-1">
            <FormField
              control={form.control}
              name="numeroCuenta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Número de cuenta</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: 9200-1234-5678-9012"
                      {...field}
                      disabled={isLoading || isEditing}
                      className={inputClass}
                    />
                  </FormControl>
                  <FormMessage />
                  {isEditing && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      El número de cuenta no se puede modificar.
                    </p>
                  )}
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={fadeInUp}>
            <FormField
              control={form.control}
              name="tipoCuenta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Tipo de cuenta</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Seleccione el tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tiposCuenta.map((tipo: any) => (
                        <SelectItem key={tipo.tipoId} value={tipo.tipoId}>
                          {tipo.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={fadeInUp}>
            <FormField
              control={form.control}
              name="moneda"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Moneda</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Seleccione la moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {monedasDisponibles.map((monedaItem) => (
                        <SelectItem key={monedaItem.codigo} value={monedaItem.codigo}>
                          {monedaItem.nombre} ({monedaItem.simbolo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={fadeInUp}>
            <FormField
              control={form.control}
              name="saldo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Saldo inicial</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        disabled={isLoading || isEditing}
                        className={cn(inputClass, "pl-7")}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                  {isEditing && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      El saldo se actualiza con las transacciones.
                    </p>
                  )}
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={fadeInUp}>
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Estado</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'true')}
                    value={field.value?.toString()}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger className={inputClass}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Activa</SelectItem>
                      <SelectItem value="false">Inactiva</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>
        </div>

        <motion.div variants={fadeInUp} className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/60">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className={outlineButtonClass}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-all shadow-md hover:shadow-lg"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Actualizar' : 'Crear'} Cuenta
          </Button>
        </motion.div>
      </motion.form>
    </Form>
  );
}
