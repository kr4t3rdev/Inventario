'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { buildVisibleSidebarGroups, SIDEBAR_CONFIG, type SidebarItemConfig } from '@/features/sidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FloatingContextValue {
  groups: ReturnType<typeof buildVisibleSidebarGroups>;
  selected: string;
  select: (title: string) => void;
  pathname: string;
}
const FloatingContext = React.createContext<FloatingContextValue | null>(null);

/**
 * @description Comparte los grupos autorizados y la sección activa de la navegación flotante.
 * @param {React.PropsWithChildren} props - Contenido de la aplicación.
 * @returns {React.JSX.Element} Proveedor de navegación.
 */
export function FloatingNavigationProvider({ children }: React.PropsWithChildren): React.JSX.Element {
  const { user } = useAuth();
  const pathname = usePathname();
  const groups = React.useMemo(() => buildVisibleSidebarGroups(SIDEBAR_CONFIG, {
    role: user?.role ?? null, tenantRole: user?.tenantRole ?? null,
    tenantId: user?.tenantId ?? null, planFeatures: user?.planFeatures ?? null,
    planName: user?.planName ?? null, permissions: user?.permissions ?? null,
    isBusyRoute: pathname.startsWith('/busy'),
  }), [user, pathname]);
  const [choice, setChoice] = React.useState<string | null>(null);
  const [choicePath, setChoicePath] = React.useState(pathname);
  const active = React.useMemo(() => {
    const matches = groups.flatMap((group) => group.items.flatMap((item) =>
      [item, ...(item.subItems ?? [])].filter((entry) => entry.url &&
        (pathname === entry.url || pathname.startsWith(`${entry.url}/`)))
        .map((entry) => ({ title: group.title, length: entry.url.length }))));
    return matches.sort((a, b) => b.length - a.length)[0]?.title;
  }, [groups, pathname]);
  const selected = (choicePath === pathname && groups.some((group) => group.title === choice) ? choice : null)
    ?? active ?? groups[0]?.title ?? '';
  const select = React.useCallback((title: string) => { setChoice(title); setChoicePath(pathname); }, [pathname]);
  return <FloatingContext.Provider value={{ groups, selected, select, pathname }}>{children}</FloatingContext.Provider>;
}

/**
 * @description Presenta los grupos autorizados en la cabecera.
 * @returns {React.JSX.Element | null} Menú principal de navegación.
 */
export function FloatingNavigationMenu(): React.JSX.Element | null {
  const context = React.useContext(FloatingContext);
  if (!context) return null;
  return <nav aria-label="Menú principal" className="flex min-w-0 items-center gap-1 overflow-x-auto">
    {context.groups.map((group) => <button key={group.title} type="button" onClick={() => context.select(group.title)}
      aria-pressed={context.selected === group.title} className={cn('min-h-11 shrink-0 rounded-full px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', context.selected === group.title ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
      {group.title}</button>)}
  </nav>;
}

/**
 * @description Presenta los destinos de la sección activa en una barra flotante.
 * @returns {React.JSX.Element | null} Barra de iconos contextual.
 */
export function FloatingNavigationRail(): React.JSX.Element | null {
  const context = React.useContext(FloatingContext);
  const group = context?.groups.find((entry) => entry.title === context.selected);
  if (!context || !group) return null;
  const activeUrl = group.items.flatMap((item) => [item, ...(item.subItems ?? [])])
    .map((item) => item.url).filter((url) => url &&
      (context.pathname === url || context.pathname.startsWith(`${url}/`)))
    .sort((a, b) => b.length - a.length)[0];
  // Cada fila mide 2.75rem, con 0.25rem entre filas y 0.5rem de relleno total.
  const height = `min(${group.items.length * 3 + 0.25}rem + 2px, calc(100dvh - 8rem))`;
  return (
    <nav
      aria-label={`Opciones de ${group.title}`}
      style={{ height }}
      className={cn(
        'fixed left-2 top-1/2 z-40 flex -translate-y-1/2 flex-col rounded-full border',
        'border-border bg-background/95 p-1 shadow-lg backdrop-blur sm:left-4',
        'motion-safe:transition-[height] motion-safe:duration-[440ms]',
        'motion-safe:ease-[cubic-bezier(0.45,0,0.35,1)]',
      )}
    >
      <div key={group.title} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-1">
          {group.items.map((item) => (
            <FloatingItem
              key={`${item.title}-${item.url}`}
              item={item}
              pathname={context.pathname}
              activeUrl={activeUrl}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

/**
 * @description Muestra un icono y permite acceder a sus destinos anidados.
 * @param {{ item: SidebarItemConfig; pathname: string }} props - Destino autorizado y ruta activa.
 * @returns {React.JSX.Element} Control de navegación.
 */
function FloatingItem({ item, pathname, activeUrl }: { item: SidebarItemConfig; pathname: string; activeUrl?: string }): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const hasChildren = Boolean(item.subItems?.length);
  const active = Boolean(activeUrl && (item.url === activeUrl ||
    item.subItems?.some((child) => child.url === activeUrl)));
  const style = cn('flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active && 'bg-primary text-primary-foreground');
  if (hasChildren) return <Popover open={open} onOpenChange={setOpen}><Tooltip><TooltipTrigger asChild><PopoverTrigger asChild><button type="button" aria-label={`Mostrar submenú de ${item.title}`} title={item.title} className={style}><item.icon className="size-5" aria-hidden="true" /></button></PopoverTrigger></TooltipTrigger><TooltipContent side="right" sideOffset={10}>{item.title}</TooltipContent></Tooltip>
    <PopoverContent side="right" align="center" sideOffset={12} className="w-60 p-2">
      <p className="px-2 py-2 text-sm font-semibold">{item.title}</p>
      {item.url && !item.subItems?.some((subItem) => subItem.url === item.url) && <Link href={item.url} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-md px-2 text-sm hover:bg-accent">{item.title}<ChevronRight className="ml-auto size-4" aria-hidden="true" /></Link>}
      {item.subItems?.map((sub) => <Link key={`${sub.title}-${sub.url}`} href={sub.url} onClick={() => setOpen(false)} aria-current={pathname === sub.url ? 'page' : undefined} className="flex min-h-11 items-center rounded-md px-2 text-sm hover:bg-accent">{sub.title}</Link>)}
    </PopoverContent></Popover>;
  return <Tooltip><TooltipTrigger asChild><Link href={item.url} aria-label={item.title} aria-current={active ? 'page' : undefined} title={item.title} className={style}><item.icon className="size-5" aria-hidden="true" /></Link></TooltipTrigger><TooltipContent side="right" sideOffset={10}>{item.title}</TooltipContent></Tooltip>;
}
