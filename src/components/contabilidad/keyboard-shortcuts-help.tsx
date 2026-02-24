'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Keyboard, Command } from 'lucide-react'
import { KeyboardShortcut } from '@/hooks/use-keyboard-shortcuts'

interface KeyboardShortcutsHelpProps {
  shortcuts: KeyboardShortcut[]
}

export function KeyboardShortcutsHelp({ shortcuts }: KeyboardShortcutsHelpProps) {
  const [open, setOpen] = useState(false)

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const keys = []
    if (shortcut.ctrlKey) keys.push('Ctrl')
    if (shortcut.altKey) keys.push('Alt')
    if (shortcut.shiftKey) keys.push('Shift')
    keys.push(shortcut.key === ' ' ? 'Space' : shortcut.key)
    return keys.join(' + ')
  }

  const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
    const category = getShortcutCategory(shortcut)
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(shortcut)
    return groups
  }, {} as Record<string, KeyboardShortcut[]>)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Keyboard className="h-4 w-4" />
          Atajos de teclado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Atajos de teclado
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="font-semibold text-lg mb-3 text-primary">{category}</h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <span className="text-sm">{shortcut.description}</span>
                    <Badge variant="outline" className="font-mono">
                      {formatShortcut(shortcut)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Tip:</strong> Presiona <Badge variant="outline" className="mx-1">?</Badge> en cualquier momento para ver esta ayuda.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getShortcutCategory(shortcut: KeyboardShortcut): string {
  if (shortcut.key === 'f' || shortcut.key === 'r') return 'Búsqueda y Filtros'
  if (shortcut.key === 'n' || shortcut.key === 't') return 'Crear Nuevo'
  if (shortcut.key === 'v' || shortcut.key === 's' || shortcut.key === 'g') return 'Reconciliación'
  if (shortcut.key === 'c' || shortcut.key === 'u') return 'Exchange y Monedas'
  if (shortcut.key.includes('Arrow') || shortcut.key === 'Home' || shortcut.key === 'End') return 'Navegación'
  if (shortcut.key === 'e') return 'Exportar'
  return 'General'
}