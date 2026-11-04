import type { LucideIcon } from 'lucide-react';

interface ManagementPageTitleProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * @description Presenta la identidad visual común de los listados de Gestión.
 * @param {ManagementPageTitleProps} props - Icono, título y descripción del listado.
 * @returns {React.JSX.Element} Título principal del listado.
 */
export function ManagementPageTitle({ icon: Icon, title, description }: ManagementPageTitleProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
