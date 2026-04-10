'use client'

import React, { useState, useCallback } from 'react'
import { useForm, UseFormReturn, FieldValues, DefaultValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form } from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Save,
  X
} from 'lucide-react'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { useLoadingStates, LOADING_KEYS } from '@/hooks/use-loading-states'
import { useRetryMechanism, RETRY_CONFIGS } from '@/hooks/use-retry-mechanism'
import { sileo } from '@/lib/sileo-shim'

import { LoadingOverlay } from './loading-components'

export interface FormConfig<T extends FieldValues> {
  schema: z.ZodSchema<T>
  defaultValues: DefaultValues<T>
  title?: string
  description?: string
  submitText?: string
  cancelText?: string
  showCancel?: boolean
  resetOnSuccess?: boolean
  validateOnChange?: boolean
  validateOnBlur?: boolean
}

export interface FormActions<T extends FieldValues> {
  onSubmit: (data: T) => Promise<void>
  onCancel?: () => void
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  onValidationError?: (errors: Record<string, string>) => void
}

export interface FormOptions {
  loadingKey?: string
  retryConfig?: typeof RETRY_CONFIGS[keyof typeof RETRY_CONFIGS]
  showSuccessMessage?: boolean
  successMessage?: string
  showErrorToast?: boolean
  autoRetry?: boolean
  confirmBeforeSubmit?: boolean
  confirmMessage?: string
}

interface EnhancedFormWrapperProps<T extends FieldValues> {
  config: FormConfig<T>
  actions: FormActions<T>
  options?: FormOptions
  children: (form: UseFormReturn<T>) => React.ReactNode
  className?: string
}

export function EnhancedFormWrapper<T extends FieldValues>({
  config,
  actions,
  options = {},
  children,
  className = '',
}: EnhancedFormWrapperProps<T>) {
  const {
    schema,
    defaultValues,
    title,
    description,
    submitText = 'Guardar',
    cancelText = 'Cancelar',
    showCancel = true,
    resetOnSuccess = false,
    validateOnChange = true,
    validateOnBlur = true,
  } = config

  const {
    onSubmit,
    onCancel,
    onSuccess,
    onError,
    onValidationError,
  } = actions

  const {
    loadingKey = LOADING_KEYS.ACCOUNT_CREATE,
    retryConfig = RETRY_CONFIGS.NETWORK_OPERATION,
    showSuccessMessage = true,
    successMessage,
    showErrorToast = true,
    autoRetry = true,
    confirmBeforeSubmit = false,
    confirmMessage = '¿Está seguro de que desea continuar?',
  } = options

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingData, setPendingData] = useState<T | null>(null)

  const { handleError, handleValidationError } = useErrorHandler()
  const { loadingStates, executeWithLoading } = useLoadingStates()
  const { executeWithRetry, retryState } = useRetryMechanism()

  const form = useForm<T>({
    resolver: zodResolver(schema as any),
    defaultValues,
    mode: validateOnChange ? 'onChange' : validateOnBlur ? 'onBlur' : 'onSubmit',
  })

  const isLoading = isSubmitting || loadingStates[loadingKey]?.isLoading || retryState.isRetrying

  const executeSubmission = useCallback(async (data: T) => {
    const submitOperation = async () => {
      await onSubmit(data)
      return data
    }

    try {
      const result = await executeWithLoading(
        loadingKey,
        autoRetry
          ? () => executeWithRetry(submitOperation, retryConfig)
          : submitOperation,
        {
          loadingMessage: 'Guardando...',
          showToast: false, // We'll handle toasts manually
        }
      )

      if (result) {
        // Success handling
        if (showSuccessMessage) {
          if (successMessage) {
            sileo.success({ title: successMessage })
          } else {
            sileo.success({ title: 'Datos guardados exitosamente.' })
          }
        }

        if (resetOnSuccess) {
          form.reset(defaultValues)
        }

        if (onSuccess) {
          onSuccess(result)
        }
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))

      setSubmitError(errorObj.message)

      if (showErrorToast) {
        handleError(errorObj, {
          operation: 'Envío de formulario',
          component: 'EnhancedFormWrapper',
        }, {
          showToast: true,
          retryAction: retryState.canRetry ? () => executeSubmission(data) : undefined,
        })
      }

      if (onError) {
        onError(errorObj)
      }
    }
  }, [
    onSubmit,
    loadingKey,
    autoRetry,
    executeWithLoading,
    executeWithRetry,
    retryConfig,
    showSuccessMessage,
    successMessage,
    resetOnSuccess,
    form,
    defaultValues,
    onSuccess,
    showErrorToast,
    handleError,
    retryState.canRetry,
    onError,
  ])

  const handleFormSubmit = useCallback(async (data: T) => {
    try {
      setSubmitError(null)
      setIsSubmitting(true)

      if (confirmBeforeSubmit) {
        setPendingData(data)
        setShowConfirmation(true)
        return
      }

      await executeSubmission(data)
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [confirmBeforeSubmit, executeSubmission])

  const handleConfirmSubmit = useCallback(async () => {
    if (pendingData) {
      setShowConfirmation(false)
      await executeSubmission(pendingData)
      setPendingData(null)
    }
  }, [pendingData, executeSubmission])

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmation(false)
    setPendingData(null)
    setIsSubmitting(false)
  }, [])

  const handleFormError = useCallback((errors: Record<string, any>) => {
    const formattedErrors: Record<string, string> = {}

    Object.entries(errors).forEach(([field, error]) => {
      if (error?.message) {
        formattedErrors[field] = error.message
      }
    })

    if (Object.keys(formattedErrors).length > 0) {
      handleValidationError(formattedErrors, { showToast: true })

      if (onValidationError) {
        onValidationError(formattedErrors)
      }
    }
  }, [handleValidationError, onValidationError])

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel()
    } else {
      form.reset(defaultValues)
      setSubmitError(null)
    }
  }, [onCancel, form, defaultValues])

  const handleRetry = useCallback(() => {
    if (pendingData) {
      executeSubmission(pendingData)
    } else {
      const currentData = form.getValues()
      executeSubmission(currentData)
    }
  }, [pendingData, executeSubmission, form])

  return (
    <>
      <Card className={className}>
        {(title || description) && (
          <CardHeader>
            {title && <CardTitle>{title}</CardTitle>}
            {description && (
              <p className="text-sm text-gray-600">{description}</p>
            )}
          </CardHeader>
        )}

        <CardContent>
          <LoadingOverlay isLoading={isLoading} message="Procesando formulario...">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleFormSubmit, handleFormError)}
                className="space-y-6"
              >
                {children(form)}

                {submitError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>{submitError}</span>
                      {retryState.canRetry && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRetry}
                          disabled={isLoading}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reintentar
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {retryState.attempts > 0 && retryState.isRetrying && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                      Reintentando operación... (Intento {retryState.attempts})
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <div className="flex items-center justify-end gap-3">
                  {showCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4 mr-2" />
                      {cancelText}
                    </Button>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || !form.formState.isValid}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {submitText}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </LoadingOverlay>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Confirmar Acción
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-6">
                {confirmMessage}
              </p>

              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleCancelConfirm}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirmar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

// Utility function to create form configs with common validation
export const createFormConfig = <T extends FieldValues>(
  schema: z.ZodSchema<T>,
  defaultValues: DefaultValues<T>,
  options: Partial<FormConfig<T>> = {}
): FormConfig<T> => ({
  schema,
  defaultValues,
  submitText: 'Guardar',
  cancelText: 'Cancelar',
  showCancel: true,
  resetOnSuccess: false,
  validateOnChange: true,
  validateOnBlur: true,
  ...options,
})

// Utility function to create form actions
export const createFormActions = <T extends FieldValues>(
  onSubmit: (data: T) => Promise<void>,
  options: Partial<FormActions<T>> = {}
): FormActions<T> => ({
  onSubmit,
  ...options,
})

// Utility function to create form options
export const createFormOptions = (
  options: Partial<FormOptions> = {}
): FormOptions => ({
  loadingKey: LOADING_KEYS.ACCOUNT_CREATE,
  retryConfig: RETRY_CONFIGS.NETWORK_OPERATION,
  showSuccessMessage: true,
  showErrorToast: true,
  autoRetry: true,
  confirmBeforeSubmit: false,
  ...options,
})