import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminTenantsActionMock = vi.fn();
const getAdminFinanceActionMock = vi.fn();
const getAdminSystemHealthActionMock = vi.fn();

vi.mock('framer-motion', () => {
  const React = require('react');
  const stripMotionProps = <T extends Record<string, unknown>>(props: T) => {
    const { animate, exit, initial, transition, variants, whileHover, whileTap, layout, ...domProps } = props;
    return domProps;
  };

  const MotionDiv = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...stripMotionProps(props)}>{children}</div>
  );
  const MotionH1 = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 {...stripMotionProps(props)}>{children}</h1>
  );
  const MotionP = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...stripMotionProps(props)}>{children}</p>
  );
  const MotionSpan = ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...stripMotionProps(props)}>{children}</span>
  );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    m: {
      div: MotionDiv,
      h1: MotionH1,
      p: MotionP,
    },
    motion: {
      span: MotionSpan,
    },
  };
});

vi.mock('@/components/ui/animations', () => ({
  PageTransition: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  StaggerContainer: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  StaggerItem: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AnimatedCard: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/features/admin', () => ({
  getAdminTenantsAction: (...args: unknown[]) => getAdminTenantsActionMock(...args),
  getAdminFinanceAction: (...args: unknown[]) => getAdminFinanceActionMock(...args),
  getAdminSystemHealthAction: (...args: unknown[]) => getAdminSystemHealthActionMock(...args),
}));

import AdminDashboardPage from './page';

describe('/admin page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminTenantsActionMock.mockResolvedValue({
      success: true,
      data: [],
    });
    getAdminFinanceActionMock.mockResolvedValue({
      success: true,
      data: {
        revenue: {
          totalIngresos: 2000,
        },
        gastos: {
          totalMonto: 700,
        },
        cuentasPorCobrar: {
          saldoPendiente: 800,
        },
        cuentasPorPagar: {
          saldoPendiente: 900,
        },
        revenueTrend: [],
        revenueComparison: {
          current7DaysRevenue: 0,
          previous7DaysRevenue: 0,
        },
      },
    });
    getAdminSystemHealthActionMock.mockResolvedValue({
      success: true,
      data: {
        users: { total: 3, byRole: [], usersTrend: [] },
        tenants: { total: 1 },
        sessions: { active: 1 },
        licenses: { total: 1, active: 1, expiringSoon: 0 },
        usersTrend: [],
        usersComparison: {
          current7DaysUsers: 0,
          previous7DaysUsers: 0,
        },
      },
    });
  });

  
});
