'use client'

import { toast, type ExternalToast } from 'sonner'

type SileoToastOptions = Omit<ExternalToast, 'description'> & {
  title: string
  description?: string
}

function toSonnerArgs(options: SileoToastOptions): [string, ExternalToast] {
  const { title, ...toastOptions } = options
  return [title, toastOptions]
}

/**
 * @description Adaptador temporal para conservar la API usada como `sileo` sobre Sonner.
 * @returns Objeto compatible con los métodos de notificación existentes.
 */
export const sileo = {
  success(options: SileoToastOptions) {
    return toast.success(...toSonnerArgs(options))
  },
  error(options: SileoToastOptions) {
    return toast.error(...toSonnerArgs(options))
  },
  warning(options: SileoToastOptions) {
    return toast.warning(...toSonnerArgs(options))
  },
  info(options: SileoToastOptions) {
    return toast.info(...toSonnerArgs(options))
  },
  dismiss(toastId?: string | number) {
    toast.dismiss(toastId)
  },
  clear() {
    toast.dismiss()
  },
}
