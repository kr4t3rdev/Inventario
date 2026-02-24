'use client'

import { useState, useCallback, useMemo } from 'react'
import { z } from 'zod'

export interface ValidationRule {
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  custom?: (value: any) => string | null
}

export interface ValidationRules {
  [field: string]: ValidationRule
}

export interface ValidationErrors {
  [field: string]: string
}

export interface UseInputValidationReturn {
  errors: ValidationErrors
  isValid: boolean
  hasErrors: boolean
  validate: (field: string, value: any) => string | null
  validateAll: (values: Record<string, any>) => boolean
  clearError: (field: string) => void
  clearAllErrors: () => void
  setError: (field: string, error: string) => void
  getFieldError: (field: string) => string | undefined
}

// Predefined validation schemas for contabilidad
export const ContabilidadValidationSchemas = {
  // Account validation
  accountName: z.string()
    .min(1, 'El nombre del banco es requerido')
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),

  accountNumber: z.string()
    .min(1, 'El número de cuenta es requerido')
    .regex(/^[0-9-]+$/, 'El número de cuenta solo puede contener números y guiones')
    .min(8, 'El número de cuenta debe tener al menos 8 caracteres')
    .max(30, 'El número de cuenta no puede exceder 30 caracteres'),

  accountType: z.enum(['corriente', 'ahorros', 'empresarial'], {
    errorMap: () => ({ message: 'Seleccione un tipo de cuenta válido' })
  }),

  balance: z.number()
    .min(-999999999, 'El saldo no puede ser menor a -999,999,999')
    .max(999999999, 'El saldo no puede ser mayor a 999,999,999'),

  // Currency validation
  currencyCode: z.string()
    .min(1, 'El código de moneda es requerido')
    .length(3, 'El código de moneda debe tener exactamente 3 caracteres')
    .regex(/^[A-Z]{3}$/, 'El código debe ser 3 letras mayúsculas (ej: USD, EUR)'),

  currencyName: z.string()
    .min(1, 'El nombre de la moneda es requerido')
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres'),

  currencySymbol: z.string()
    .min(1, 'El símbolo de la moneda es requerido')
    .max(5, 'El símbolo no puede exceder 5 caracteres'),

  exchangeRate: z.number()
    .min(0.0001, 'La tasa de cambio debe ser mayor a 0')
    .max(999999, 'La tasa de cambio no puede exceder 999,999')
    .refine(
      (val) => Number.isFinite(val) && val > 0,
      'La tasa de cambio debe ser un número válido mayor a 0'
    ),

  // Transfer validation
  transferAmount: z.number()
    .min(0.01, 'El monto debe ser mayor a 0')
    .max(999999999, 'El monto no puede exceder 999,999,999'),

  transferReason: z.string()
    .min(1, 'El motivo de la transferencia es requerido')
    .min(5, 'El motivo debe tener al menos 5 caracteres')
    .max(200, 'El motivo no puede exceder 200 caracteres'),

  // Adjustment validation
  adjustmentAmount: z.number()
    .min(0.01, 'El monto debe ser mayor a 0')
    .max(999999999, 'El monto no puede exceder 999,999,999'),

  adjustmentDescription: z.string()
    .min(1, 'La descripción es requerida')
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(500, 'La descripción no puede exceder 500 caracteres'),

  adjustmentReason: z.string()
    .min(1, 'El motivo es requerido')
    .min(5, 'El motivo debe tener al menos 5 caracteres')
    .max(200, 'El motivo no puede exceder 200 caracteres'),

  // Payment type validation
  paymentTypeName: z.string()
    .min(1, 'El nombre del tipo de pago es requerido')
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres'),

  paymentTypeDescription: z.string()
    .max(200, 'La descripción no puede exceder 200 caracteres')
    .optional(),

  // General validation
  positiveNumber: z.number()
    .min(0, 'El valor debe ser positivo'),

  requiredString: z.string()
    .min(1, 'Este campo es requerido'),

  optionalString: z.string().optional(),

  email: z.string()
    .email('Ingrese un email válido')
    .optional(),

  date: z.date({
    errorMap: () => ({ message: 'Ingrese una fecha válida' })
  }),

  dateRange: z.object({
    from: z.date({ errorMap: () => ({ message: 'Fecha de inicio requerida' }) }),
    to: z.date({ errorMap: () => ({ message: 'Fecha de fin requerida' }) }),
  }).refine(
    (data) => data.from <= data.to,
    {
      message: 'La fecha de inicio debe ser anterior a la fecha de fin',
      path: ['to'],
    }
  ),
}

// Custom validation functions for specific business rules
export const ContabilidadValidators = {
  // Validate account number uniqueness (would need to check against existing accounts)
  uniqueAccountNumber: (accountNumber: string, existingNumbers: string[] = []) => {
    if (existingNumbers.includes(accountNumber)) {
      return 'Este número de cuenta ya existe'
    }
    return null
  },

  // Validate sufficient balance for operations
  sufficientBalance: (amount: number, availableBalance: number) => {
    if (amount > availableBalance) {
      return `Saldo insuficiente. Disponible: ${availableBalance.toLocaleString()}`
    }
    return null
  },

  // Validate exchange rate reasonableness
  reasonableExchangeRate: (rate: number, previousRate?: number) => {
    if (previousRate) {
      const changePercent = Math.abs((rate - previousRate) / previousRate) * 100
      if (changePercent > 50) {
        return `Cambio muy significativo en la tasa (${changePercent.toFixed(1)}%). Verifique el valor.`
      }
    }
    return null
  },

  // Validate transfer between different accounts
  differentAccounts: (fromAccountId: string, toAccountId: string) => {
    if (fromAccountId === toAccountId) {
      return 'La cuenta origen y destino deben ser diferentes'
    }
    return null
  },

  // Validate currency compatibility
  currencyCompatibility: (fromCurrency: string, toCurrency: string, exchangeRate?: number) => {
    if (fromCurrency !== toCurrency && !exchangeRate) {
      return 'Se requiere una tasa de cambio para monedas diferentes'
    }
    return null
  },

  // Validate date ranges
  validDateRange: (fromDate: Date, toDate: Date) => {
    if (fromDate > toDate) {
      return 'La fecha de inicio debe ser anterior a la fecha de fin'
    }

    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 365) {
      return 'El rango de fechas no puede exceder 365 días'
    }

    return null
  },

  // Validate business hours for operations
  businessHours: (date: Date = new Date()) => {
    const hour = date.getHours()
    const day = date.getDay()

    // Weekend check
    if (day === 0 || day === 6) {
      return 'Las operaciones bancarias no están disponibles los fines de semana'
    }

    // Business hours check (8 AM to 6 PM)
    if (hour < 8 || hour >= 18) {
      return 'Las operaciones bancarias solo están disponibles de 8:00 AM a 6:00 PM'
    }

    return null
  },
}

export function useInputValidation(
  validationRules?: ValidationRules,
  zodSchema?: z.ZodSchema
): UseInputValidationReturn {
  const [errors, setErrors] = useState<ValidationErrors>({})

  const validate = useCallback((field: string, value: any): string | null => {
    // Clear previous error for this field
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })

    let error: string | null = null

    // Use Zod schema validation if provided
    if (zodSchema) {
      try {
        const fieldSchema = (zodSchema as any).shape?.[field]
        if (fieldSchema) {
          fieldSchema.parse(value)
        }
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          error = zodError.errors[0]?.message || 'Valor inválido'
        }
      }
    }

    // Use custom validation rules if provided and no Zod error
    if (!error && validationRules?.[field]) {
      const rule = validationRules[field]

      // Required validation
      if (rule.required && (value === null || value === undefined || value === '')) {
        error = 'Este campo es requerido'
      }

      // Min/Max validation for numbers
      if (!error && typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          error = `El valor mínimo es ${rule.min}`
        }
        if (rule.max !== undefined && value > rule.max) {
          error = `El valor máximo es ${rule.max}`
        }
      }

      // Min/Max validation for strings
      if (!error && typeof value === 'string') {
        if (rule.min !== undefined && value.length < rule.min) {
          error = `Debe tener al menos ${rule.min} caracteres`
        }
        if (rule.max !== undefined && value.length > rule.max) {
          error = `No puede exceder ${rule.max} caracteres`
        }
      }

      // Pattern validation
      if (!error && rule.pattern && typeof value === 'string') {
        if (!rule.pattern.test(value)) {
          error = 'Formato inválido'
        }
      }

      // Custom validation
      if (!error && rule.custom) {
        error = rule.custom(value)
      }
    }

    // Set error if found
    if (error) {
      setErrors(prev => ({
        ...prev,
        [field]: error as string, // Type assertion since we know error is not null here
      }))
    }

    return error
  }, [validationRules, zodSchema])

  const validateAll = useCallback((values: Record<string, unknown>): boolean => {
    let hasErrors = false

    // Validate using Zod schema if provided
    if (zodSchema) {
      try {
        zodSchema.parse(values)
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          const newErrors: ValidationErrors = {}
          zodError.errors.forEach(error => {
            const field = error.path.join('.')
            newErrors[field] = error.message
          })
          setErrors(newErrors)
          hasErrors = Object.keys(newErrors).length > 0
        }
      }
    }

    // Validate using custom rules if no Zod schema or additional validation needed
    if (!zodSchema || validationRules) {
      const fieldsToValidate = validationRules
        ? Object.keys(validationRules)
        : Object.keys(values)

      for (const field of fieldsToValidate) {
        const error = validate(field, values[field])
        if (error) {
          hasErrors = true
        }
      }
    }

    return !hasErrors
  }, [validate, validationRules, zodSchema])

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  const clearAllErrors = useCallback(() => {
    setErrors({})
  }, [])

  const setError = useCallback((field: string, error: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: error,
    }))
  }, [])

  const getFieldError = useCallback((field: string): string | undefined => {
    return errors[field]
  }, [errors])

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0
  }, [errors])

  const hasErrors = useMemo(() => {
    return Object.keys(errors).length > 0
  }, [errors])

  return {
    errors,
    isValid,
    hasErrors,
    validate,
    validateAll,
    clearError,
    clearAllErrors,
    setError,
    getFieldError,
  }
}