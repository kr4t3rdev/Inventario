/**
 * @description Componente para configurar umbrales personalizados de alertas
 * Permite al usuario ajustar los umbrales de cada tipo de alerta del sistema
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Settings, RotateCcw, Save, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { selectCustomThresholds, setCustomThresholds, resetCustomThresholds } from '@/lib/redux/slices/exchangeIntelligenceSlice'
import { UmbralesPersonalizados } from '@/types/exchange-intelligence'

/**
 * @description Props del componente de configuración de umbrales
 */
interface ThresholdConfigurationProps {
  /**
   * @description Clase CSS adicional para el componente
   */
  className?: string
}

/**
 * @description Configuración de cada umbral con metadata
 */
interface ThresholdConfig {
  key: keyof UmbralesPersonalizados
  label: string
  description: string
  unit: string
  min: number
  max: number
  step: number
  default_value: number
}

/**
 * @description Configuración de todos los umbrales disponibles
 */
const THRESHOLD_CONFIGS: ThresholdConfig[] = [
  {
    key: 'cost_increase_alert',
    label: 'Incremento de Costos',
    description: 'Alerta cuando el costo de reposición supera el costo histórico',
    unit: '%',
    min: 1,
    max: 50,
    step: 1,
    default_value: 10,
  },
  {
    key: 'debt_exposure_alert',
    label: 'Pérdida No Realizada',
    description: 'Alerta cuando la pérdida no realizada en deudas supera este porcentaje',
    unit: '%',
    min: 1,
    max: 20,
    step: 0.5,
    default_value: 5,
  },
  {
    key: 'spread_alert',
    label: 'Spread Bancario',
    description: 'Alerta cuando el spread bancario promedio supera este porcentaje',
    unit: '%',
    min: 0.5,
    max: 10,
    step: 0.5,
    default_value: 3,
  },
  {
    key: 'break_even_warning',
    label: 'Proximidad a Equilibrio (Advertencia)',
    description: 'Advertencia cuando la tasa actual alcanza este porcentaje de la tasa de equilibrio',
    unit: '%',
    min: 70,
    max: 99,
    step: 1,
    default_value: 90,
  },
  {
    key: 'break_even_critical',
    label: 'Proximidad a Equilibrio (Crítico)',
    description: 'Alerta crítica cuando la tasa actual alcanza o supera este porcentaje',
    unit: '%',
    min: 90,
    max: 120,
    step: 1,
    default_value: 100,
  },
  {
    key: 'margin_alert',
    label: 'Diferencia de Márgenes',
    description: 'Alerta cuando la diferencia entre margen real y nominal supera este porcentaje',
    unit: '%',
    min: 5,
    max: 50,
    step: 1,
    default_value: 15,
  },
  {
    key: 'differential_alert',
    label: 'Diferencial Cambiario',
    description: 'Alerta cuando el diferencial cambiario negativo supera este porcentaje de ingresos',
    unit: '%',
    min: 1,
    max: 20,
    step: 1,
    default_value: 5,
  },
  {
    key: 'currency_trend_alert',
    label: 'Tendencia de Moneda',
    description: 'Alerta cuando una moneda con deudas tiene tendencia alcista superior a este porcentaje mensual',
    unit: '%',
    min: 1,
    max: 20,
    step: 1,
    default_value: 5,
  },
]

/**
 * @description Valores por defecto de los umbrales
 */
const DEFAULT_THRESHOLDS: UmbralesPersonalizados = {
  cost_increase_alert: 10,
  debt_exposure_alert: 5,
  spread_alert: 3,
  break_even_warning: 90,
  break_even_critical: 100,
  margin_alert: 15,
  differential_alert: 5,
  currency_trend_alert: 5,
}

/**
 * @description Componente de configuración de umbrales personalizados
 * @param props - Props del componente
 * @returns Componente de configuración de umbrales
 */
export function ThresholdConfiguration(props: ThresholdConfigurationProps) {
  const { className } = props
  const dispatch = useAppDispatch()
  const current_thresholds = useAppSelector(selectCustomThresholds)
  
  const [is_open, set_is_open] = useState(false)
  const [local_thresholds, set_local_thresholds] = useState<UmbralesPersonalizados>({ ...DEFAULT_THRESHOLDS, ...current_thresholds })
  const [validation_errors, set_validation_errors] = useState<Partial<Record<keyof UmbralesPersonalizados, string>>>({})
  const [has_changes, set_has_changes] = useState(false)

  /**
   * @description Sincroniza los umbrales locales con los del store cuando se abre el diálogo
   */
  useEffect(() => {
    if (is_open) {
      set_local_thresholds({ ...DEFAULT_THRESHOLDS, ...current_thresholds })
      set_validation_errors({})
      set_has_changes(false)
    }
  }, [is_open, current_thresholds])

  /**
   * @description Valida un valor de umbral
   * @param config - Configuración del umbral
   * @param value - Valor a validar
   * @returns Mensaje de error o null si es válido
   */
  function validate_threshold_value(config: ThresholdConfig, value: number): string | null {
    if (isNaN(value)) {
      return 'Debe ser un número válido'
    }
    
    if (value < config.min) {
      return `El valor mínimo es ${config.min}${config.unit}`
    }
    
    if (value > config.max) {
      return `El valor máximo es ${config.max}${config.unit}`
    }

    // Validación especial: break_even_warning debe ser menor que break_even_critical
    if (config.key === 'break_even_warning') {
      const critical_value = local_thresholds.break_even_critical
      if (value >= critical_value) {
        return `Debe ser menor que el umbral crítico (${critical_value}${config.unit})`
      }
    }

    if (config.key === 'break_even_critical') {
      const warning_value = local_thresholds.break_even_warning
      if (value <= warning_value) {
        return `Debe ser mayor que el umbral de advertencia (${warning_value}${config.unit})`
      }
    }
    
    return null
  }

  /**
   * @description Maneja el cambio de un umbral
   * @param key - Clave del umbral
   * @param value - Nuevo valor
   */
  function handle_threshold_change(key: keyof UmbralesPersonalizados, value: string) {
    const numeric_value = parseFloat(value)
    const config = THRESHOLD_CONFIGS.find(c => c.key === key)
    
    if (!config) return

    // Actualizar valor local
    const new_thresholds = { ...local_thresholds, [key]: numeric_value }
    set_local_thresholds(new_thresholds)
    set_has_changes(true)

    // Validar
    const error = validate_threshold_value(config, numeric_value)
    set_validation_errors(prev => ({
      ...prev,
      [key]: error || undefined,
    }))

    // Re-validar umbrales relacionados
    if (key === 'break_even_warning' || key === 'break_even_critical') {
      const warning_config = THRESHOLD_CONFIGS.find(c => c.key === 'break_even_warning')!
      const critical_config = THRESHOLD_CONFIGS.find(c => c.key === 'break_even_critical')!
      
      const warning_error = validate_threshold_value(warning_config, new_thresholds.break_even_warning)
      const critical_error = validate_threshold_value(critical_config, new_thresholds.break_even_critical)
      
      set_validation_errors(prev => ({
        ...prev,
        break_even_warning: warning_error || undefined,
        break_even_critical: critical_error || undefined,
      }))
    }
  }

  /**
   * @description Guarda los umbrales en Redux y localStorage
   */
  function handle_save() {
    // Verificar que no hay errores de validación
    const has_errors = Object.values(validation_errors).some(error => error !== undefined)
    
    if (has_errors) {
      toast.error('Por favor, corrija los errores de validación antes de guardar')
      return
    }

    // Guardar en Redux
    dispatch(setCustomThresholds(local_thresholds))

    // Guardar en localStorage
    try {
      localStorage.setItem('exchange_intelligence_thresholds', JSON.stringify(local_thresholds))
      toast.success('Umbrales guardados correctamente')
      set_has_changes(false)
      set_is_open(false)
    } catch (error) {
      console.error('Error al guardar umbrales en localStorage:', error)
      toast.error('Error al guardar la configuración')
    }
  }

  /**
   * @description Restaura los umbrales a los valores por defecto
   */
  function handle_reset_defaults() {
    set_local_thresholds(DEFAULT_THRESHOLDS)
    set_validation_errors({})
    set_has_changes(true)
    toast.info('Umbrales restaurados a valores por defecto')
  }

  /**
   * @description Carga los umbrales desde localStorage al montar el componente
   */
  useEffect(() => {
    try {
      const stored_thresholds = localStorage.getItem('exchange_intelligence_thresholds')
      if (stored_thresholds) {
        const parsed_thresholds = JSON.parse(stored_thresholds) as UmbralesPersonalizados
        dispatch(setCustomThresholds(parsed_thresholds))
      }
    } catch (error) {
      console.error('Error al cargar umbrales desde localStorage:', error)
    }
  }, [dispatch])

  return (
    <Dialog open={is_open} onOpenChange={set_is_open}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Settings className="h-4 w-4 mr-2" />
          Configurar Umbrales
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuración de Umbrales de Alertas</DialogTitle>
          <DialogDescription>
            Personaliza los umbrales para cada tipo de alerta del sistema. Los cambios se aplicarán inmediatamente.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Los umbrales determinan cuándo se generan alertas en el dashboard. Ajústalos según las necesidades de tu negocio.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-4">
          {THRESHOLD_CONFIGS.map((config) => (
            <Card key={config.key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                <CardDescription className="text-xs">{config.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor={config.key} className="sr-only">
                      {config.label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={config.key}
                        type="number"
                        min={config.min}
                        max={config.max}
                        step={config.step}
                        value={local_thresholds[config.key]}
                        onChange={(e) => handle_threshold_change(config.key, e.target.value)}
                        className={validation_errors[config.key] ? 'border-red-500' : ''}
                      />
                      <span className="text-sm text-muted-foreground min-w-[30px]">{config.unit}</span>
                    </div>
                    {validation_errors[config.key] && (
                      <p className="text-xs text-red-500 mt-1">{validation_errors[config.key]}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Rango: {config.min} - {config.max}{config.unit}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handle_reset_defaults}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Valores por Defecto
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => set_is_open(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handle_save}
              disabled={!has_changes || Object.values(validation_errors).some(error => error !== undefined)}
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
