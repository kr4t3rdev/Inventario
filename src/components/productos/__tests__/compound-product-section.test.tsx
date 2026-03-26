import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FormProvider, useForm } from 'react-hook-form'

import { CompoundProductSection } from '../compound-product-section'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy({}, {
    get: (_, tag: string) => {
      const Component = ({
        children,
        whileHover,
        whileTap,
        initial,
        animate,
        transition,
        ...props
      }: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) =>
        React.createElement(tag, props, children)
      Component.displayName = `motion.${tag}`
      return Component
    },
  }),
}))

interface TestFormValues {
  esCompuesto?: boolean
  cantidadEnPack?: number
  nombreHijo?: string
  precioVenta?: number
  precioCosto?: number
}

function renderSection(): void {
  function Wrapper(): React.JSX.Element {
    const form = useForm<TestFormValues>({
      defaultValues: {
        esCompuesto: true,
        cantidadEnPack: 20,
        nombreHijo: 'Cigarro (unidad)',
        precioVenta: 500,
        precioCosto: 400,
      },
    })

    return (
      <FormProvider {...form}>
        <CompoundProductSection
          parentBusinessCode='0114028500012'
          childBusinessCodePreview='0114028500029'
          childSurtidoPreview='0002'
          parentSegmentSummary={{
            proveedorCodigo: '01',
            idSeccionCodigo: '14',
            especificoCodigo: '0285',
          }}
        />
      </FormProvider>
    )
  }

  render(<Wrapper />)
}

describe('CompoundProductSection', () => {
  it('muestra previews heredados y oculta la captura manual del código hijo', () => {
    renderSection()

    expect(screen.getByText('Código base del padre')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0114028500029')).toBeInTheDocument()
    expect(screen.getByText('Proveedor heredado')).toBeInTheDocument()
    expect(screen.getByText('Sección / específico heredados')).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Código de negocio del producto individual/i)
    ).not.toBeInTheDocument()
  })
})
