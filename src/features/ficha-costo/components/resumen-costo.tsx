import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { IndicadorMargen } from './indicador-margen'
import { ResumenPlantillaCard } from './resumen-plantilla-card'
import type { FichaCostoData } from '../actions'

interface ResumenCostoProps {
  data: FichaCostoData
}

const fmt = (n: number, moneda: string) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(n)

/**
 * @description Tarjeta de resumen de la ficha de costo: muestra CPP o
 *   costo compuesto, precio de costo registrado, precio de venta, margen
 *   absoluto y porcentual. Si el cálculo quedó en 0 con advertencias, las
 *   muestra para que el usuario sepa por qué.
 */
export function ResumenCosto({ data }: ResumenCostoProps) {
  const { producto, costoCalculado, margen, advertencias } = data
  const sinDatos = costoCalculado.valor === 0 || margen.estado === 'SIN_DATOS'
  const esServicio = producto.entityType === 'SERVICIO'
  const serviceStatusTone =
    margen.estado === 'SIN_DATOS'
      ? 'border-amber-500/40 bg-amber-50'
      : 'border-emerald-500/40 bg-emerald-50'
  const serviceStatusTitle =
    margen.estado === 'SIN_DATOS'
      ? 'Costo del servicio no disponible'
      : 'Costo del servicio calculado'
  const serviceStatusMessage =
    margen.estado === 'SIN_DATOS'
      ? 'El CPP del servicio solo se calcula cuando todas las compras históricas conservan una moneda snapshot consistente.'
      : `El CPP del servicio se calculó usando compras históricas con moneda consistente (${costoCalculado.moneda}).`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span>Resumen de costo</span>
          <IndicadorMargen porcentaje={margen.porcentaje} estado={margen.estado} />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          label={`Costo calculado (${costoCalculado.metodo ?? 'N/D'})`}
          value={sinDatos ? 'N/A' : fmt(costoCalculado.valor, costoCalculado.moneda)}
        />
        <Stat
          label={esServicio ? 'Costo base de referencia' : 'Precio de costo registrado'}
          value={fmt(producto.precioCosto, costoCalculado.moneda)}
        />
        <Stat
          label="Precio de venta"
          value={fmt(producto.precioVenta, costoCalculado.moneda)}
        />
        <Stat
          label="Margen absoluto"
          value={margen.absoluto === null ? 'N/A' : fmt(margen.absoluto, costoCalculado.moneda)}
        />
        <Stat
          label="Margen porcentual"
          value={margen.porcentaje === null ? 'N/A' : `${margen.porcentaje.toFixed(2)}%`}
        />
        <Stat
          label={`Variación vs estándar (${
            data.variacion.porcentaje === null
              ? 'N/A'
              : `${data.variacion.porcentaje.toFixed(2)}% · ${data.variacion.estado}`
          })`}
          value={
            data.variacion.absoluto === null
              ? 'N/A'
              : fmt(data.variacion.absoluto, costoCalculado.moneda)
          }
        />
        {!esServicio && (
          <Stat
            label={`Mermas (30d, esperado ${data.merma.desperdicioEsperadoPromedio?.toFixed(1) ?? 'N/A'}%)`}
            value={
              data.merma.cantidad30d === 0
                ? 'Sin mermas'
                : `${data.merma.cantidad30d}${
                    data.merma.porcentajeSobreStock === null
                      ? ''
                      : ` (${data.merma.porcentajeSobreStock.toFixed(1)}% stock)`
                  }`
            }
          />
        )}
        <Stat label={esServicio ? 'Tipo de entidad' : 'Tipo de producto'} value={producto.tipo} />
        {!esServicio && (
          <ResumenPlantillaCard
            productoId={producto.id}
            precioVenta={producto.precioVenta}
          />
        )}
      </CardContent>
      {advertencias.length > 0 && (
        <CardContent>
          <Alert variant="default" className="border-amber-500/40 bg-amber-50">
            <AlertTitle>Advertencias</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc text-sm">
                {advertencias.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      )}
      {esServicio && (
        <CardContent>
          <Alert variant="default" className={serviceStatusTone}>
            <AlertTitle>{serviceStatusTitle}</AlertTitle>
            <AlertDescription>{serviceStatusMessage}</AlertDescription>
          </Alert>
        </CardContent>
      )}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}
