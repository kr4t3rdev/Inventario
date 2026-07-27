'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * @description Shell mínimo y aislado para el Gestor de Ventas.
 * @param {{ children: React.ReactNode }} props - Contenido protegido.
 * @returns {React.JSX.Element} Navegación de referidos y cierre de sesión.
 */
export function SalesAgentShell({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();

  const logout = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Gestor de Ventas
            </p>
            <Link className="font-semibold" href="/sales-agent/referidos">
              Referidos
            </Link>
          </div>
          <button
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
            type="button"
            onClick={() => void logout()}
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
