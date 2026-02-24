import { useEffect, useCallback } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  action: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const matchingShortcut = shortcuts.find(shortcut => {
      return (
        shortcut.key.toLowerCase() === event.key.toLowerCase() &&
        !!shortcut.ctrlKey === event.ctrlKey &&
        !!shortcut.altKey === event.altKey &&
        !!shortcut.shiftKey === event.shiftKey
      )
    })

    if (matchingShortcut) {
      event.preventDefault()
      matchingShortcut.action()
    }
  }, [shortcuts])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return shortcuts
}

// Common shortcuts for contabilidad module
export const contabilidadShortcuts = {
  // Navigation shortcuts
  newAccount: { key: 'n', ctrlKey: true, description: 'Nueva cuenta bancaria' },
  newTransfer: { key: 't', ctrlKey: true, description: 'Nueva transferencia' },
  reconcileVentas: { key: 'v', ctrlKey: true, description: 'Reconciliar ventas' },
  reconcileServicios: { key: 's', ctrlKey: true, description: 'Reconciliar servicios' },
  reconcileGastos: { key: 'g', ctrlKey: true, description: 'Reconciliar gastos' },
  
  // Quick actions
  quickSearch: { key: 'f', ctrlKey: true, description: 'Búsqueda rápida' },
  clearFilters: { key: 'r', ctrlKey: true, description: 'Limpiar filtros' },
  exportData: { key: 'e', ctrlKey: true, description: 'Exportar datos' },
  
  // Exchange shortcuts
  currencyConverter: { key: 'c', ctrlKey: true, altKey: true, description: 'Convertidor de moneda' },
  updateRates: { key: 'u', ctrlKey: true, altKey: true, description: 'Actualizar tasas' },
  
  // Pagination
  nextPage: { key: 'ArrowRight', ctrlKey: true, description: 'Página siguiente' },
  previousPage: { key: 'ArrowLeft', ctrlKey: true, description: 'Página anterior' },
  firstPage: { key: 'Home', ctrlKey: true, description: 'Primera página' },
  lastPage: { key: 'End', ctrlKey: true, description: 'Última página' }
}