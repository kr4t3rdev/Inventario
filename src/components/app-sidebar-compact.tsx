'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LayoutDashboard, Search, Shield, Star } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { buildVisibleSidebarGroups, SIDEBAR_CONFIG, type SidebarItemConfig } from '@/features/sidebar';
import { cn } from '@/lib/utils';
import { NavUser } from './nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, useSidebar } from './ui/sidebar';

/**
 * @description Sidebar compacto con navegación filtrada, búsqueda y favoritos locales.
 * @param {React.ComponentProps<typeof Sidebar>} props - Propiedades del contenedor lateral.
 * @returns {React.JSX.Element} Navegación del tenant actual.
 */
export function AppSidebarCompact(props: React.ComponentProps<typeof Sidebar>): React.JSX.Element {
  const { user } = useAuth();
  const { state, setOpen, isMobile } = useSidebar();
  const pathname = usePathname();
  const collapsed = state === 'collapsed' && !isMobile;
  const [query, setQuery] = React.useState('');
  const [opened, setOpened] = React.useState<string[]>(['Gestión']);
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const storageKey = `financemdm-sidebar-favorites:${user?.tenantId ?? 'sin-tenant'}`;

  const groups = React.useMemo(() => buildVisibleSidebarGroups(SIDEBAR_CONFIG, {
    role: user?.role ?? null,
    tenantRole: user?.tenantRole ?? null,
    tenantId: user?.tenantId ?? null,
    planFeatures: user?.planFeatures ?? null,
    planName: user?.planName ?? null,
    permissions: user?.permissions ?? null,
    isBusyRoute: pathname.startsWith('/busy'),
  }), [user, pathname]);

  const matchesPath = (url: string) => Boolean(url) &&
    (pathname === url || pathname.startsWith(`${url}/`));
  const activeUrl = groups.flatMap((group) => group.items.flatMap((item) =>
    [item, ...(item.subItems ?? [])]))
    .map((item) => item.url).filter(matchesPath).sort((a, b) => b.length - a.length)[0];
  const activeGroupTitle = groups.find((group) => group.items.some((item) =>
    item.url === activeUrl || item.subItems?.some((sub) => sub.url === activeUrl)))?.title;

  React.useEffect(() => {
    if (activeGroupTitle) setOpened((current) => current.includes(activeGroupTitle) ? current : [...current, activeGroupTitle]);
  }, [activeGroupTitle, pathname]);

  React.useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      setFavorites(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : []);
    } catch {
      setFavorites([]);
    }
  }, [storageKey]);

  const availableItems = React.useMemo(() => groups.flatMap((group) => group.items.flatMap((item) =>
    [item, ...(item.subItems ?? [])].filter((entry) => Boolean(entry.url)))), [groups]);
  const favoriteItems = availableItems.filter((item, index, all) =>
    favorites.includes(item.url) && all.findIndex((entry) => entry.url === item.url) === index);
  const normalizedQuery = query.trim().toLocaleLowerCase('es');

  /**
   * @description Agrega o elimina un destino autorizado de favoritos.
   * @param {string} url - Ruta del destino visible.
   * @returns {void} Actualiza la preferencia local cuando está disponible.
   */
  function toggleFavorite(url: string): void {
    const next = favorites.includes(url) ? favorites.filter((value) => value !== url) : [...favorites, url];
    setFavorites(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* almacenamiento opcional */ }
  }

  /**
   * @description Cambia la sección abierta y expande la barra si está colapsada.
   * @param {string} title - Nombre de la sección.
   * @returns {void} Actualiza la navegación visible.
   */
  function toggleGroup(title: string): void {
    if (collapsed) {
      setOpen(true);
      setOpened((current) => current.includes(title) ? current : [...current, title]);
      return;
    }
    setOpened((current) => current.includes(title) ? current.filter((value) => value !== title) : [...current, title]);
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <Link href={SIDEBAR_CONFIG.dashboardUrl} aria-label="FinanceMDM, inicio" className="flex min-h-11 items-center gap-2 rounded-md px-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <LayoutDashboard className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {!collapsed && <span>FinanceMDM</span>}
        </Link>
        {!collapsed && <label className="relative block">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input type="search" aria-label="Buscar en el menú" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en menú..." className="h-10 w-full rounded-md border border-sidebar-border bg-background pl-9 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" />
        </label>}
      </SidebarHeader>
      <SidebarContent className="gap-1 px-2 py-3">
        {!collapsed && favoriteItems.length > 0 && !normalizedQuery && <nav aria-label="Favoritos" className="mb-3 border-b border-sidebar-border pb-3">
          <div className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold text-muted-foreground"><Star className="size-4" aria-hidden="true" /> Favoritos</div>
          {favoriteItems.map((item) => <CompactItem key={item.url} item={item} pathname={pathname} activeUrl={activeUrl} favorites={favorites} onFavorite={toggleFavorite} />)}
        </nav>}
        {groups.map((group) => {
          const items = normalizedQuery ? group.items.flatMap((item) => {
            const matches = item.title.toLocaleLowerCase('es').includes(normalizedQuery);
            const subItems = item.subItems?.filter((sub) => sub.title.toLocaleLowerCase('es').includes(normalizedQuery));
            return matches ? [item] : subItems?.length ? [{ ...item, subItems }] : [];
          }) : group.items;
          if (!items.length) return null;
          const expanded = !collapsed && (Boolean(normalizedQuery) || opened.includes(group.title));
          return <section key={group.title}>
            <button type="button" title={collapsed ? group.title : undefined} aria-label={collapsed ? `Abrir ${group.title}` : undefined} aria-expanded={expanded} onClick={() => toggleGroup(group.title)} className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
              <span className="flex size-6 shrink-0 items-center justify-center text-primary">{group.items[0]?.icon && React.createElement(group.items[0].icon, { className: 'size-4', 'aria-hidden': true })}</span>
              {!collapsed && <><span className="min-w-0 flex-1 truncate">{group.title}</span><ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', expanded && 'rotate-180')} /></>}
            </button>
            {expanded && <nav aria-label={group.title} className="space-y-0.5 pb-2 pl-3">{items.map((item) => <CompactItem key={`${item.title}-${item.url}`} item={item} pathname={pathname} activeUrl={activeUrl} favorites={favorites} onFavorite={toggleFavorite} searchActive={Boolean(normalizedQuery)} />)}</nav>}
          </section>;
        })}
        {normalizedQuery && !groups.some((group) => group.items.some((item) => item.title.toLocaleLowerCase('es').includes(normalizedQuery) || item.subItems?.some((sub) => sub.title.toLocaleLowerCase('es').includes(normalizedQuery)))) && <p className="px-2 py-3 text-sm text-muted-foreground">Sin resultados.</p>}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        {user?.role === 'admin' && <Link href="/admin" aria-label="Panel de Control" className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-sidebar-accent"><Shield className="size-4" aria-hidden="true" />{!collapsed && 'Panel de Control'}</Link>}
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

interface CompactItemProps {
  item: SidebarItemConfig;
  pathname: string;
  activeUrl?: string;
  favorites: string[];
  onFavorite: (url: string) => void;
  searchActive?: boolean;
}

/**
 * @description Presenta un destino autorizado y sus posibles submenús.
 * @param {CompactItemProps} props - Destino y estado de navegación.
 * @returns {React.JSX.Element} Fila de navegación accesible.
 */
function CompactItem({ item, pathname, activeUrl, favorites, onFavorite, searchActive = false }: CompactItemProps): React.JSX.Element {
  const [open, setOpen] = React.useState(() => Boolean(item.subItems?.some((sub) => sub.url === activeUrl)));
  React.useEffect(() => {
    if (item.subItems?.some((sub) => sub.url === activeUrl)) setOpen(true);
  }, [activeUrl, item.subItems]);
  const hasChildren = Boolean(item.subItems?.length);
  const active = Boolean(item.url) && item.url === activeUrl;
  return <div>
    <div className={cn('group/item flex min-h-11 items-center rounded-md text-sm hover:bg-sidebar-accent', active && 'bg-sidebar-accent text-primary')}>
      {item.url ? <Link href={item.url} aria-current={active ? 'page' : undefined} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><item.icon className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 whitespace-normal break-words py-2 leading-5">{item.title}</span></Link> : <button type="button" onClick={() => setOpen(!open)} aria-expanded={open || searchActive} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><item.icon className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 whitespace-normal break-words py-2 leading-5">{item.title}</span></button>}
      {item.url && <button type="button" aria-label={`${favorites.includes(item.url) ? 'Quitar' : 'Añadir'} ${item.title} ${favorites.includes(item.url) ? 'de' : 'a'} favoritos`} aria-pressed={favorites.includes(item.url)} onClick={() => onFavorite(item.url)} className="flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><Star className={cn('size-4', favorites.includes(item.url) ? 'fill-primary text-primary' : 'text-muted-foreground')} aria-hidden="true" /></button>}
      {hasChildren && item.url && <button type="button" aria-label={`${open ? 'Ocultar' : 'Mostrar'} submenú de ${item.title}`} aria-expanded={open || searchActive} onClick={() => setOpen(!open)} className="flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><ChevronDown className={cn('size-4', (open || searchActive) && 'rotate-180')} aria-hidden="true" /></button>}
    </div>
    {hasChildren && (open || searchActive) && <div className="ml-4 border-l border-sidebar-border pl-2">{item.subItems?.map((sub) => <CompactItem key={`${sub.title}-${sub.url}`} item={sub} pathname={pathname} activeUrl={activeUrl} favorites={favorites} onFavorite={onFavorite} />)}</div>}
  </div>;
}
