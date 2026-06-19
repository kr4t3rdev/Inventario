/**
 * @description Elementos de UI para diferenciar cuadre operativo vs histórico.
 */
'use client';

import { AlertTriangle, ArrowLeft, Loader2, Lock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * @description Advertencia contextual para cuadres consultados en modo histórico.
 * @param {{ isReadOnly: boolean }} props - Controla si la advertencia se renderiza.
 * @returns {JSX.Element | null} Badge y advertencia o null.
 */
export function CuadreDetailReadonlyNotice({
  isReadOnly,
}: {
  isReadOnly: boolean;
}): JSX.Element | null {
  if (!isReadOnly) return null;

  return (
    <div className='space-y-3'>
      <Badge variant='outline'>Consulta histórica</Badge>
      <div className='rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'>
        <div className='flex items-start gap-3'>
          <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
          <div className='space-y-1'>
            <p className='font-medium'>Detalle histórico de solo lectura</p>
            <p>El bloque de inventario no es un snapshot histórico exacto</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @description Barra de acciones del cuadre respetando el modo readonly histórico.
 * @param {object} props - Props del componente.
 * @param {string} props.backLabel - Texto del botón de retorno.
 * @param {boolean} props.isClosing - Estado de envío del cierre.
 * @param {boolean} props.isReadOnly - Si el turno ya está cerrado.
 * @param {() => void} props.onBack - Callback de retorno.
 * @param {() => void} props.onCerrarTurno - Callback de cierre.
 * @param {() => void} props.onRepetirArqueo - Callback de re-arqueo.
 * @param {boolean} props.tieneDiferencia - Indica si el arqueo tiene diferencia.
 * @returns {JSX.Element} Footer de acciones.
 */
export function CuadreDetailActions({
  backLabel,
  isClosing,
  isReadOnly,
  onBack,
  onCerrarTurno,
  onRepetirArqueo,
  tieneDiferencia,
}: {
  backLabel: string;
  isClosing: boolean;
  isReadOnly: boolean;
  onBack: () => void;
  onCerrarTurno: () => void;
  onRepetirArqueo: () => void;
  tieneDiferencia: boolean;
}): JSX.Element {
  return (
    <div className='container mx-auto flex max-w-6xl items-center justify-between gap-3'>
      <Button variant='outline' onClick={onBack} className='gap-1.5'>
        <ArrowLeft className='h-4 w-4' />
        {backLabel}
      </Button>

      {!isReadOnly && (
        <div className='flex items-center gap-3'>
          {tieneDiferencia && (
            <Button variant='outline' onClick={onRepetirArqueo} className='gap-1.5'>
              Repetir Arqueo
            </Button>
          )}

          <Button
            variant='default'
            onClick={onCerrarTurno}
            disabled={tieneDiferencia || isClosing}
            className={cn(
              'gap-1.5 min-w-[160px]',
              !tieneDiferencia &&
                'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
            )}
          >
            {isClosing ? <Loader2 className='h-4 w-4 animate-spin' /> : <Lock className='h-4 w-4' />}
            {tieneDiferencia ? 'Cierre bloqueado' : 'Cerrar Turno'}
          </Button>
        </div>
      )}
    </div>
  );
}
