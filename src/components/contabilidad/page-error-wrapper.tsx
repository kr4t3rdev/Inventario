'use client'

import React from 'react'
import { ContabilidadErrorBoundary } from './error-boundary'
import { useErrorHandler } from '@/hooks/use-error-handler'

interface PageErrorWrapperProps {
  children: React.ReactNode
  pageName: string
}

export function PageErrorWrapper({ children, pageName }: PageErrorWrapperProps) {
  const { handleError } = useErrorHandler()

  const handlePageError = (error: Error, errorInfo: React.ErrorInfo) => {
    handleError(error, {
      operation: `Página ${pageName}`,
      component: 'PageErrorWrapper',
      additionalData: {
        errorInfo,
        pageName,
      },
    }, {
      showToast: true,
      logError: true,
    })
  }

  return (
    <ContabilidadErrorBoundary onError={handlePageError}>
      {children}
    </ContabilidadErrorBoundary>
  )
}