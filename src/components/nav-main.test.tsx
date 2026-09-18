import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('./ui/sidebar', () => ({
  SidebarGroupContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
  SidebarMenu: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <ul {...props}>{children}</ul>
  ),
  SidebarMenuItem: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <li {...props}>{children}</li>
  ),
  SidebarMenuButton: ({
    asChild,
    children,
    tooltip: _tooltip,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, props)
    }

    return <button {...props}>{children}</button>
  },
}))

import { NavMain } from './nav-main'

describe('NavMain', () => {
  it('nombra el control de submenú, expone su estado y mantiene un objetivo táctil de 44px', async () => {
    const user = userEvent.setup()
    render(
      <NavMain
        label="Inventario"
        items={[
          {
            title: 'Inventario',
            url: '/busy/inventario',
            subItems: [{ title: 'Productos', url: '/busy/productos' }],
          },
        ]}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Mostrar submenú de Inventario' })
    const groupNavigation = screen.getByRole('navigation', { name: 'Inventario' })
    const inventoryLink = screen.getByRole('link', { name: 'Inventario' })

    expect(groupNavigation).toContainElement(inventoryLink)
    expect(inventoryLink.querySelector('button')).toBeNull()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveClass('min-h-11', 'min-w-11')

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const productsLink = screen.getByRole('link', { name: 'Productos' })
    expect(productsLink.querySelector('button')).toBeNull()
  })
})
