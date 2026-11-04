'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavUser } from './nav-user';
import { AppSidebar2 } from './app-sidebar2';
import { FloatingNavigationProvider, FloatingNavigationMenu, FloatingNavigationRail } from './floating-navigation';
import { AppSidebarCompact } from './app-sidebar-compact';
import { SidebarProvider, SidebarTrigger, useSidebar, type Sidebar } from './ui/sidebar';

const STORAGE_KEY = 'financemdm-sidebar-view';
type SidebarView = 'classic' | 'compact' | 'floating';
interface SidebarViewContextValue {
  view: SidebarView | null;
  selectView: (view: SidebarView) => void;
}
const SidebarViewContext = createContext<SidebarViewContextValue | null>(null);

/**
 * @description Comparte la preferencia de navegación y la conserva en el navegador.
 * @param {React.PropsWithChildren} props - Contenido del espacio de trabajo.
 * @returns {React.JSX.Element} Proveedor de la vista seleccionada.
 */
export function SidebarViewProvider({ children }: React.PropsWithChildren): React.JSX.Element {
  const [view, setView] = useState<SidebarView | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      setView(saved === 'compact' || saved === 'floating' ? saved : 'classic');
    } catch {
      setView('classic');
    }
  }, []);

  const selectView = (next: SidebarView) => {
    setView(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* sesión actual */ }
  };
  return <SidebarViewContext.Provider value={{ view, selectView }}>{children}</SidebarViewContext.Provider>;
}

/**
 * @description Adapta el ancho del shell al diseño de navegación elegido.
 * @param {React.PropsWithChildren} props - Contenido del shell.
 * @returns {React.JSX.Element} Proveedor de la barra lateral.
 */
export function SidebarViewShell({ children }: React.PropsWithChildren): React.JSX.Element {
  const context = useContext(SidebarViewContext);
  const style = context?.view === 'compact'
    ? ({ '--sidebar-width': '15rem' } as React.CSSProperties)
    : undefined;
  return <FloatingNavigationProvider><SidebarProvider style={style}>{children}</SidebarProvider></FloatingNavigationProvider>;
}

/**
 * @description Renderiza la navegación elegida con las propiedades del shell.
 * @param {React.ComponentProps<typeof Sidebar>} props - Propiedades de la barra lateral.
 * @returns {React.JSX.Element} Navegación seleccionada.
 */
export function SidebarViewSelection(props: React.ComponentProps<typeof Sidebar>): React.JSX.Element | null {
  const context = useContext(SidebarViewContext);
  if (context && context.view === null) return null;
  if (context?.view === 'floating') return <FloatingNavigationRail />;
  return context?.view === 'compact' ? <AppSidebarCompact {...props} /> : <AppSidebar2 {...props} />;
}

/**
 * @description Contrae o expande la barra lateral seleccionada.
 * @returns {React.JSX.Element} Control de la navegación actual.
 */
export function SidebarViewCollapse(): React.JSX.Element | null {
  const context = useContext(SidebarViewContext);
  const { isMobile, openMobile, open } = useSidebar();
  if (context?.view === 'floating') return null;
  const expanded = isMobile ? openMobile : open;
  const label = expanded ? 'Contraer barra lateral' : 'Expandir barra lateral';
  return <SidebarTrigger aria-label={label} aria-expanded={expanded} title={label} className="-ml-1 size-11" />;
}

/**
 * @description Permite alternar entre los diseños de navegación.
 * @returns {React.JSX.Element | null} Control de selección de vista.
 */
export function SidebarViewToggle(): React.JSX.Element | null {
  const context = useContext(SidebarViewContext);
  if (!context || context.view === null) return null;
  return (
    <select aria-label="Vista de navegación" value={context.view}
      onChange={(event) => context.selectView(event.target.value as SidebarView)}
      className="h-11 max-w-32 rounded-md bg-transparent text-sm focus-visible:ring-2 focus-visible:ring-ring">
      <option value="classic">Vista clásica</option>
      <option value="compact">Vista compacta</option>
      <option value="floating">Vista flotante</option>
    </select>
  );
}

/** Muestra el menú superior únicamente en la vista flotante. */
export function FloatingHeaderMenu(): React.JSX.Element | null {
  const context = useContext(SidebarViewContext);
  return context?.view === 'floating' ? <><a href="/busy/dashboard" className="font-semibold shrink-0">FinanceMDM</a><div className="flex flex-1 justify-center min-w-0 2xl:absolute 2xl:left-1/2 2xl:-translate-x-1/2"><FloatingNavigationMenu /></div></> : null;
}

/** Aplica el espacio de navegación a la vista flotante. */
export function SidebarContentFrame({ children }: React.PropsWithChildren): React.JSX.Element {
  const context = useContext(SidebarViewContext);
  return <div className={context?.view === 'floating' ? 'pl-20' : undefined}>{children}</div>;
}

/** Aplica el estilo del encabezado según la vista. */
export function SidebarHeaderFrame({ children }: React.PropsWithChildren): React.JSX.Element {
  const context = useContext(SidebarViewContext);
  return <header className={`relative flex h-12 min-w-0 items-center gap-2 ${context?.view === 'floating' ? '' : 'border-b'}`}>{children}</header>;
}

/** Controles de cuenta disponibles en la navegación flotante. */
export function FloatingAccount(): React.JSX.Element | null {
  const context = useContext(SidebarViewContext);
  if (context?.view !== 'floating') return null;
  return <div className="flex items-center"><NavUser compact /></div>;
}
