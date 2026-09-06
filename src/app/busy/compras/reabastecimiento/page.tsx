import { sugerirReabastecimientoAction } from '@/features/compras-productos/actions-reabastecimiento';

export const metadata = { title: 'Reabastecimiento - FinanceMDM' };
export const dynamic = 'force-dynamic';

/**
 * @description Página base para sugerencias min/max. La consulta se ejecuta
 * desde el servidor para aplicar el tenant y la feature flag.
 * @returns {Promise<JSX.Element>} Lista de sugerencias.
 */
export default async function ReabastecimientoPage() {
  const result = await sugerirReabastecimientoAction({});
  const suggestions = result.success ? (result.data ?? []) as any[] : [];
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Reabastecimiento</h1>
      <p className="text-sm text-muted-foreground">Sugerencias para recuperar el stock hasta el máximo configurado.</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-3">Producto</th><th className="p-3">Disponible</th><th className="p-3">Mínimo</th><th className="p-3">Máximo</th><th className="p-3">Sugerencia</th></tr></thead>
          <tbody>
            {suggestions.map((suggestion) => <tr key={suggestion.reglaId} className="border-b"><td className="p-3">{suggestion.productoNombre}</td><td className="p-3">{suggestion.disponible}</td><td className="p-3">{suggestion.min}</td><td className="p-3">{suggestion.max}</td><td className="p-3 font-medium">{suggestion.tipo}: {suggestion.cantidadSugerida}</td></tr>)}
            {suggestions.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No hay productos bajo el mínimo.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
