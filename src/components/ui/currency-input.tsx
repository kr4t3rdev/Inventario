import React, { useRef } from 'react'
import { Input } from '@/components/ui/input'

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  /**
   * Valor numérico del input (sin formato)
   */
  value: number | string | undefined
  /**
   * Callback cuando el valor cambia (devuelve string para form)
   */
  onChange: (value: string) => void
  /**
   * Símbolo de moneda a mostrar (opcional)
   */
  currencySymbol?: string
}

/**
 * @description Input para valores monetarios con formato automático a 2 decimales.
 * Valida entrada, formatea visualización y mantiene valor limpio internamente.
 * @param {CurrencyInputProps} props - Props del componente
 * @returns {JSX.Element} Input de moneda formateado
 */
export function CurrencyInput({
  value,
  onChange,
  currencySymbol = '$',
  disabled = false,
  ...props
}: CurrencyInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Formatea un número a 2 decimales para visualización
   */
  const formatDisplay = (num: number | string | undefined): string => {
    if (num === undefined || num === '' || num === null) {
      return ''
    }
    const numValue = typeof num === 'string' ? parseFloat(num) : num
    if (isNaN(numValue)) {
      return ''
    }
    return numValue.toFixed(2)
  }

  /**
   * Valida y limpia la entrada del usuario
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value

    // Permitir entrada vacía
    if (rawValue === '') {
      onChange('')
      return
    }

    // Permitir solo números y un punto decimal
    const cleaned = rawValue.replace(/[^\d.]/g, '')

    // Evitar múltiples puntos
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      return
    }

    // Limitar a 2 decimales
    if (parts[1] && parts[1].length > 2) {
      return
    }

    // Actualizar valor
    onChange(cleaned)

    // Actualizar visualización del input
    if (inputRef.current) {
      inputRef.current.value = cleaned
    }
  }

  /**
   * Al perder el foco, formatea a 2 decimales
   */
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value)
    if (!isNaN(numValue)) {
      onChange(numValue.toString())
      if (inputRef.current) {
        inputRef.current.value = formatDisplay(numValue)
      }
    }
    props.onBlur?.(e)
  }

  /**
   * Al enfocar, muestra el valor sin formato
   */
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value && !isNaN(parseFloat(e.target.value))) {
      e.target.value = String(value || '')
    }
    props.onFocus?.(e)
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      placeholder="0.00"
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      defaultValue={formatDisplay(value)}
      className="transition-all duration-200 focus-visible:ring-primary/30"
      {...props}
    />
  )
}
