'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { ManagementPageTitle } from '@/components/management-page-title';

interface ReabastecimientoSuggestion {
  reglaId: string;
  productoNombre: string;
  disponible: number;
  min: number;
  max: number;
  tipo: string;
  cantidadSugerida: number;
}

interface ReabastecimientoPageClientProps {
  suggestions: ReabastecimientoSuggestion[];
  error: string | null;
}

/**
 * @description Presenta y anima las sugerencias de reabastecimiento.
 * @param {ReabastecimientoPageClientProps} props - Sugerencias y posible error de carga.
 * @returns {JSX.Element} Página de reabastecimiento.
 */
export function ReabastecimientoPageClient({
  suggestions,
  error,
}: ReabastecimientoPageClientProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-4 p-6">
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
      >
        <ManagementPageTitle
          icon={RefreshCw}
          title="Reabastecimiento"
          description="Sugerencias para recuperar el stock hasta el máximo configurado."
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.3 }}
        className="space-y-4"
      >
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Producto</th>
                <th className="p-3">Disponible</th>
                <th className="p-3">Mínimo</th>
                <th className="p-3">Máximo</th>
                <th className="p-3">Sugerencia</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((suggestion) => (
                <tr key={suggestion.reglaId} className="border-b">
                  <td className="p-3">{suggestion.productoNombre}</td>
                  <td className="p-3">{suggestion.disponible}</td>
                  <td className="p-3">{suggestion.min}</td>
                  <td className="p-3">{suggestion.max}</td>
                  <td className="p-3 font-medium">
                    {suggestion.tipo}: {suggestion.cantidadSugerida}
                  </td>
                </tr>
              ))}
              {suggestions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No hay productos bajo el mínimo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
