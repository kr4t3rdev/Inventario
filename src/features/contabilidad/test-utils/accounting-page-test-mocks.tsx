import React from 'react';
import { vi } from 'vitest';

const accountingPageTestState = vi.hoisted(() => ({
  replace: vi.fn(),
  user: null as { role: string; planFeatures?: Record<string, boolean> } | null,
  canAccess: false,
  hideBasicItem: false,
}));

/**
 * @description Obtiene el estado compartido de las pruebas de páginas contables.
 * @returns {typeof accountingPageTestState} Estado de auth, acceso y navegación.
 */
export function getAccountingPageTestState(): typeof accountingPageTestState {
  return accountingPageTestState;
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: accountingPageTestState.replace }),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-accounting-content" />,
}));
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: accountingPageTestState.user }),
}));
vi.mock('@/lib/plan-access', () => ({
  canAccessAccountingItem: () => accountingPageTestState.canAccess,
  shouldHideBasicAccountingItem: () => accountingPageTestState.hideBasicItem,
}));
vi.mock('@/features/contabilidad/components/accounting-page-shell', () => ({
  AccountingPageShell: ({
    title,
    description,
    actions,
    children,
  }: React.PropsWithChildren<{
    title: string;
    description: string;
    actions?: React.ReactNode;
  }>) => (
    <main data-testid="accounting-page-shell">
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
      {children}
    </main>
  ),
}));
vi.mock('@/features/contabilidad/components/accounting-policy-card', () => ({
  AccountingPolicyCard: () => <div>Políticas contables</div>,
}));
