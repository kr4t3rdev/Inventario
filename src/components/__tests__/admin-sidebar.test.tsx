import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminSidebar } from '../admin-sidebar';

const mockUseAuth = vi.fn();
const mockUseIsMounted = vi.fn();
const mockUseSidebar = vi.fn();

vi.mock('framer-motion', () => {
  const React = require('react');

  const stripMotionProps = <T extends Record<string, unknown>>(props: T) => {
    const { animate, exit, initial, transition, variants, whileHover, ...domProps } = props;
    return domProps;
  };

  const MotionDiv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div ref={ref} {...stripMotionProps(props)}>
        {children}
      </div>
    ),
  );
  MotionDiv.displayName = 'MockMotionDiv';

  const MotionSpan = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
    ({ children, ...props }, ref) => (
      <span ref={ref} {...stripMotionProps(props)}>
        {children}
      </span>
    ),
  );
  MotionSpan.displayName = 'MockMotionSpan';

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    m: {
      div: MotionDiv,
      span: MotionSpan,
    },
    useReducedMotion: () => true,
  };
});

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/use-is-mounted', () => ({
  useIsMounted: () => mockUseIsMounted(),
}));

vi.mock('../ui/sidebar', () => ({
  Sidebar: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SidebarContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SidebarFooter: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SidebarHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SidebarRail: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  SidebarGroup: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <section {...props}>{children}</section>,
  SidebarGroupLabel: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SidebarSeparator: (props: React.HTMLAttributes<HTMLHRElement>) => <hr {...props} />,
  useSidebar: () => mockUseSidebar(),
}));

vi.mock('../nav-main', () => ({
  NavMain: ({ items }: { items: Array<{ title: string; url: string }> }) => (
    <nav>
      {items.map((item) => (
        <a key={item.url} href={item.url}>
          {item.title}
        </a>
      ))}
    </nav>
  ),
}));

vi.mock('../nav-user', () => ({
  NavUser: () => <div>NavUser</div>,
}));

describe('AdminSidebar', () => {
  it('renders the operational administration group with Datos Maestros link', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Admin' } });
    mockUseIsMounted.mockReturnValue(true);
    mockUseSidebar.mockReturnValue({ state: 'expanded' });

    render(<AdminSidebar />);

    expect(screen.getByText('Administración Operativa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Datos Maestros' })).toHaveAttribute(
      'href',
      '/admin/operaciones/maestros',
    );
  });
});
